import hashlib
import hmac
import os
import time
from typing import Any

import requests
from pydantic import BaseModel, ConfigDict

from platform_helpers.ode_store import read_ode_config, write_ode_config


DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_REFRESH_WINDOW_SECONDS = 86400
DEFAULT_PARTNER_ID = "lazop-sdk-go-20230910"

REGION_BASE_MAP = {
    "SG": "https://api.lazada.sg/rest",
    "MY": "https://api.lazada.com.my/rest",
    "VN": "https://api.lazada.vn/rest",
    "TH": "https://api.lazada.co.th/rest",
    "PH": "https://api.lazada.com.ph/rest",
    "ID": "https://api.lazada.co.id/rest",
}


class LazadaConfigError(Exception):
    pass


class LazadaAPIError(Exception):
    def __init__(self, message: str, code: str | None = None, request_id: str | None = None):
        super().__init__(message)
        self.code = code
        self.request_id = request_id


class LazadaConfig(BaseModel):
    """Lazada API configuration from environment variables."""

    app_key: str = ""
    app_secret: str = ""
    access_token: str = ""
    refresh_token: str = ""
    access_token_expires_at: int | None = None
    refresh_expires_at: int | None = None
    region: str = "MY"
    api_base: str = "https://api.lazada.com.my/rest"
    partner_id: str = ""

    model_config = ConfigDict(
        extra="forbid",
        validate_default=True,
    )

    def save(self) -> None:
        config = read_ode_config()
        marketplace = config.setdefault("marketplace", {})
        lazada = marketplace.setdefault("lazada", {})
        lazada["accessToken"] = self.access_token
        lazada["refreshToken"] = self.refresh_token
        lazada["accessTokenExpiresAt"] = self.access_token_expires_at
        lazada["refreshExpiresAt"] = self.refresh_expires_at
        write_ode_config(config)

    @classmethod
    def from_env(cls) -> "LazadaConfig":
        app_key = os.environ.get("BOLTY_LAZADA_APP_KEY", "").strip()
        app_secret = os.environ.get("BOLTY_LAZADA_APP_SECRET", "").strip()
        access_token = os.environ.get("BOLTY_LAZADA_ACCESS_TOKEN", "").strip()
        refresh_token = os.environ.get("BOLTY_LAZADA_REFRESH_TOKEN", "").strip()
        region = (os.environ.get("BOLTY_LAZADA_REGION", "MY").strip() or "MY").upper()
        api_base = os.environ.get("BOLTY_LAZADA_API_BASE", "").strip() or REGION_BASE_MAP.get(region, "")
        partner_id = os.environ.get("BOLTY_LAZADA_PARTNER_ID", DEFAULT_PARTNER_ID).strip() or DEFAULT_PARTNER_ID

        ode_cfg = read_ode_config()
        lazada_cfg = ode_cfg.get("marketplace", {}).get("lazada", {})
        if lazada_cfg.get("accessToken"):
            access_token = lazada_cfg["accessToken"]
        if lazada_cfg.get("refreshToken"):
            refresh_token = lazada_cfg["refreshToken"]

        access_token_expires_at = None
        refresh_expires_at = None
        if "accessTokenExpiresAt" in lazada_cfg:
            access_token_expires_at = lazada_cfg["accessTokenExpiresAt"]
        if "refreshExpiresAt" in lazada_cfg:
            refresh_expires_at = lazada_cfg["refreshExpiresAt"]

        missing = []
        if not app_key:
            missing.append("BOLTY_LAZADA_APP_KEY")
        if not app_secret:
            missing.append("BOLTY_LAZADA_APP_SECRET")
        if not access_token:
            missing.append("BOLTY_LAZADA_ACCESS_TOKEN")
        if not api_base:
            missing.append("BOLTY_LAZADA_API_BASE or valid BOLTY_LAZADA_REGION")

        if missing:
            raise LazadaConfigError(f"Missing required Lazada config: {', '.join(missing)}")

        return cls(
            app_key=app_key,
            app_secret=app_secret,
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_at=access_token_expires_at,
            refresh_expires_at=refresh_expires_at,
            region=region,
            api_base=api_base,
            partner_id=partner_id,
        )


def _stringify(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class LazadaClient:
    def __init__(self, config: LazadaConfig, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS):
        self.config = config
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self._access_token_expires_at = config.access_token_expires_at
        self._refresh_expires_at = config.refresh_expires_at

    def _timestamp(self) -> int:
        return int(time.time())

    def _set_token_state(self, access_token: str | None, refresh_token: str | None, expire_in: int | None, refresh_expire_in: int | None = None) -> None:
        if access_token:
            self.config.access_token = access_token
        if refresh_token:
            self.config.refresh_token = refresh_token
        if expire_in is not None:
            self._access_token_expires_at = self._timestamp() + int(expire_in)
        if refresh_expire_in is not None:
            self._refresh_expires_at = self._timestamp() + int(refresh_expire_in)
        self.config.save()

    def _should_refresh(self) -> bool:
        if not self.config.refresh_token:
            return False
        if not self.config.access_token:
            return True
        if self._access_token_expires_at is None:
            return True
        return (self._access_token_expires_at - self._timestamp()) <= DEFAULT_REFRESH_WINDOW_SECONDS

    def _ensure_token(self) -> None:
        if not self._should_refresh():
            return
        from platform_helpers.lazada.auth import refresh_access_token as _refresh
        result = _refresh(
            app_key=self.config.app_key,
            app_secret=self.config.app_secret,
            refresh_token=self.config.refresh_token or None,
        )
        self._set_token_state(
            result.get("access_token"),
            result.get("refresh_token"),
            result.get("expires_in"),
            result.get("refresh_expires_in"),
        )

    def _timestamp_ms(self) -> str:
        return str(int(round(time.time()))) + "000"

    def _base_params(self) -> dict[str, str]:
        return {
            "app_key": self.config.app_key,
            "access_token": self.config.access_token,
            "sign_method": "sha256",
            "timestamp": self._timestamp_ms(),
            "partner_id": self.config.partner_id,
        }

    def _sign(self, api_path: str, params: dict[str, Any]) -> str:
        keys = sorted(params.keys())
        message = [api_path]
        for key in keys:
            message.append(f"{key}{_stringify(params[key])}")
        payload = "".join(message).encode("utf-8")
        digest = hmac.new(
            self.config.app_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return digest.upper()

    def _execute(self, api_path: str, api_params: dict[str, Any], *, method: str) -> dict[str, Any]:
        self._ensure_token()
        params: dict[str, Any] = self._base_params()
        params.update(api_params)
        params["sign"] = self._sign(api_path, params)

        api_url = f"{self.config.api_base}{api_path}"
        request_params = {key: _stringify(value) for key, value in params.items()}

        normalized_method = method.upper()
        if normalized_method == "POST":
            response = self.session.post(api_url, data=request_params, timeout=self.timeout_seconds)
        elif normalized_method == "GET":
            response = self.session.get(api_url, params=request_params, timeout=self.timeout_seconds)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        payload = response.json()

        code = payload.get("code")

        if code not in (None, "0", 0):
            raise LazadaAPIError(
                message=payload.get("message") or "Lazada API returned non-zero code",
                code=str(code),
                request_id=payload.get("request_id"),
            )

        return payload

    def get(self, api_path: str, api_params: dict[str, Any]) -> dict[str, Any]:
        return self._execute(api_path, api_params, method="GET")

    def post(self, api_path: str, api_params: dict[str, Any]) -> dict[str, Any]:
        return self._execute(api_path, api_params, method="POST")
