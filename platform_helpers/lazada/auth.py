"""
Lazada auth module — token authorization and refresh.

Auth endpoints use the standard signed-request format (HMAC-SHA256) but only
with the essential params: app_key, timestamp, sign_method, code/refresh_token.
They do NOT include partner_id or access_token in the request or signature.
"""

import hashlib
import hmac
import os
import time
from typing import Any

import requests

from .client import LazadaAPIError, LazadaConfigError

AUTH_API_BASE = "https://auth.lazada.com/rest"
CREATE_ENDPOINT = "/auth/token/create"
REFRESH_ENDPOINT = "/auth/token/refresh"
DEFAULT_TIMEOUT = 15


def _stringify(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _sign(app_secret: str, api_path: str, params: dict[str, Any]) -> str:
    keys = sorted(params.keys())
    message = [api_path]
    for key in keys:
        message.append(f"{key}{_stringify(params[key])}")
    payload = "".join(message).encode("utf-8")
    digest = hmac.new(
        app_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return digest.upper()


def _call_signed_get(
    app_key: str,
    app_secret: str,
    api_path: str,
    extra_params: dict[str, str],
) -> dict[str, Any]:
    """Make a signed GET request to a Lazada auth endpoint."""
    params: dict[str, Any] = {
        "app_key": app_key,
        "sign_method": "sha256",
        "timestamp": str(int(round(time.time()))) + "000",
    }
    params.update(extra_params)
    params["sign"] = _sign(app_secret, api_path, params)

    api_url = f"{AUTH_API_BASE}{api_path}"

    resp = requests.get(api_url, params={k: _stringify(v) for k, v in params.items()}, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    payload: dict[str, Any] = resp.json()

    code = payload.get("code")
    if code not in (None, "0", 0):
        raise LazadaAPIError(
            message=payload.get("message") or "Token request failed",
            code=str(code),
            request_id=payload.get("request_id"),
        )

    return payload


def _extract_tokens(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "access_token": payload.get("access_token", ""),
        "refresh_token": payload.get("refresh_token", ""),
        "expires_in": payload.get("expires_in", 0),
        "refresh_expires_in": payload.get("refresh_expires_in", 0),
        "account_platform": payload.get("account_platform", ""),
        "account": payload.get("account", ""),
        "country": payload.get("country", ""),
        "country_user_info": payload.get("country_user_info", []),
        "code": payload.get("code"),
        "request_id": payload.get("request_id"),
    }


def authorize_access_token(
    app_key: str | None = None,
    app_secret: str | None = None,
    code: str | None = None,
) -> dict[str, Any]:
    app_key = (app_key or os.environ.get("BOLTY_LAZADA_APP_KEY", "")).strip()
    app_secret = (app_secret or os.environ.get("BOLTY_LAZADA_APP_SECRET", "")).strip()
    code = (code or "").strip()

    missing = []
    if not app_key:
        missing.append("app_key / BOLTY_LAZADA_APP_KEY")
    if not app_secret:
        missing.append("app_secret / BOLTY_LAZADA_APP_SECRET")
    if not code:
        missing.append("code / --code")
    if missing:
        raise LazadaConfigError(f"Missing required params: {', '.join(missing)}")

    payload = _call_signed_get(app_key, app_secret, CREATE_ENDPOINT, {"code": code})
    return _extract_tokens(payload)


def refresh_access_token(
    app_key: str | None = None,
    app_secret: str | None = None,
    refresh_token: str | None = None,
) -> dict[str, Any]:
    app_key = (app_key or os.environ.get("BOLTY_LAZADA_APP_KEY", "")).strip()
    app_secret = (app_secret or os.environ.get("BOLTY_LAZADA_APP_SECRET", "")).strip()
    refresh_token = (refresh_token or os.environ.get("BOLTY_LAZADA_REFRESH_TOKEN", "")).strip()

    missing = []
    if not app_key:
        missing.append("app_key / BOLTY_LAZADA_APP_KEY")
    if not app_secret:
        missing.append("app_secret / BOLTY_LAZADA_APP_SECRET")
    if not refresh_token:
        missing.append("refresh_token / BOLTY_LAZADA_REFRESH_TOKEN")
    if missing:
        raise LazadaConfigError(f"Missing required params: {', '.join(missing)}")

    payload = _call_signed_get(app_key, app_secret, REFRESH_ENDPOINT, {"refresh_token": refresh_token})
    return _extract_tokens(payload)
