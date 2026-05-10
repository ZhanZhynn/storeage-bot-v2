from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from .client import ShopeeAPIError, ShopeeClient
from .models import (
    ShippingDocumentDataInfoResponse,
    ShippingDocumentDownloadResponse,
    ShippingDocumentParameterResponse,
    ShippingDocumentResultResponse,
    ShippingOrderResponse,
    ShippingParameterResponse,
    TrackingNumberResponse,
)


def get_shipping_parameter(
    client: ShopeeClient,
    *,
    order_sn: str,
    package_number: str | None = None,
) -> ShippingParameterResponse:
    if not order_sn:
        raise ValueError("order_sn must not be empty")

    params: dict[str, Any] = {"order_sn": order_sn}
    if package_number:
        params["package_number"] = package_number

    payload = client.get("/api/v2/logistics/get_shipping_parameter", params)
    request_id = payload.get("request_id")
    response = payload.get("response") or {}
    if not isinstance(response, dict):
        response = {}

    return ShippingParameterResponse(
        endpoint="/api/v2/logistics/get_shipping_parameter",
        request_ids=[str(request_id)] if request_id else [],
        order_sn=order_sn,
        package_number=package_number,
        response=response,
    )


def ship_order(
    client: ShopeeClient,
    *,
    order_sn: str,
    package_number: str | None = None,
    pickup: dict[str, Any] | None = None,
    dropoff: dict[str, Any] | None = None,
    non_integrated: dict[str, Any] | None = None,
) -> ShippingOrderResponse:
    if not order_sn:
        raise ValueError("order_sn must not be empty")
    provided = [value is not None for value in (pickup, dropoff, non_integrated)].count(True)
    if provided != 1:
        raise ValueError("exactly one of pickup, dropoff, non_integrated must be provided")

    payload: dict[str, Any] = {"order_sn": order_sn}
    if pickup is not None:
        payload["pickup"] = pickup
    if dropoff is not None:
        payload["dropoff"] = dropoff
    if non_integrated is not None:
        payload["non_integrated"] = non_integrated
    if package_number:
        payload["package_number"] = package_number

    response = client.post("/api/v2/logistics/ship_order", payload)
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}

    return ShippingOrderResponse(
        endpoint="/api/v2/logistics/ship_order",
        request_ids=[str(request_id)] if request_id else [],
        response=body,
    )


def update_shipping_order(
    client: ShopeeClient,
    *,
    order_sn: str,
    address_id: int,
    pickup_time_id: str,
    package_number: str | None = None,
) -> ShippingOrderResponse:
    if not order_sn:
        raise ValueError("order_sn must not be empty")
    if not address_id:
        raise ValueError("address_id must not be empty")
    if not pickup_time_id:
        raise ValueError("pickup_time_id must not be empty")

    payload: dict[str, Any] = {
        "order_sn": order_sn,
        "pickup": {
            "address_id": address_id,
            "pickup_time_id": pickup_time_id,
        },
    }
    if package_number:
        payload["package_number"] = package_number

    response = client.post("/api/v2/logistics/update_shipping_order", payload)
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}

    return ShippingOrderResponse(
        endpoint="/api/v2/logistics/update_shipping_order",
        request_ids=[str(request_id)] if request_id else [],
        response=body,
    )


def get_tracking_number(
    client: ShopeeClient,
    *,
    order_sn: str,
    package_number: str | None = None,
    response_optional_fields: str | None = None,
) -> TrackingNumberResponse:
    if not order_sn:
        raise ValueError("order_sn must not be empty")

    params: dict[str, Any] = {"order_sn": order_sn}
    if package_number:
        params["package_number"] = package_number
    if response_optional_fields:
        params["response_optional_fields"] = response_optional_fields

    response = client.get("/api/v2/logistics/get_tracking_number", params)
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}

    return TrackingNumberResponse(
        endpoint="/api/v2/logistics/get_tracking_number",
        request_ids=[str(request_id)] if request_id else [],
        response=body,
    )


def get_shipping_document_parameter(
    client: ShopeeClient,
    *,
    order_list: list[dict[str, Any]],
) -> ShippingDocumentParameterResponse:
    if not order_list:
        raise ValueError("order_list must not be empty")

    response = client.post(
        "/api/v2/logistics/get_shipping_document_parameter",
        {"order_list": order_list},
    )
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}
    result_list = body.get("result_list") or []
    if not isinstance(result_list, list):
        result_list = []
    warning = body.get("warning")
    if warning is not None and not isinstance(warning, list):
        warning = [str(warning)]

    return ShippingDocumentParameterResponse(
        endpoint="/api/v2/logistics/get_shipping_document_parameter",
        request_ids=[str(request_id)] if request_id else [],
        result_list=[item for item in result_list if isinstance(item, dict)],
        warning=warning,
    )


def create_shipping_document(
    client: ShopeeClient,
    *,
    order_list: list[dict[str, Any]],
    shipping_document_type: str | None = None,
) -> ShippingDocumentResultResponse:
    if not order_list:
        raise ValueError("order_list must not be empty")

    payload: dict[str, Any] = {"order_list": order_list}
    if shipping_document_type:
        payload["shipping_document_type"] = shipping_document_type

    response = client.post("/api/v2/logistics/create_shipping_document", payload)
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}
    result_list = body.get("result_list") or []
    if not isinstance(result_list, list):
        result_list = []

    return ShippingDocumentResultResponse(
        endpoint="/api/v2/logistics/create_shipping_document",
        request_ids=[str(request_id)] if request_id else [],
        result_list=[item for item in result_list if isinstance(item, dict)],
    )


def get_shipping_document_result(
    client: ShopeeClient,
    *,
    order_list: list[dict[str, Any]],
    shipping_document_type: str | None = None,
) -> ShippingDocumentResultResponse:
    if not order_list:
        raise ValueError("order_list must not be empty")

    payload: dict[str, Any] = {"order_list": order_list}
    if shipping_document_type:
        payload["shipping_document_type"] = shipping_document_type

    response = client.post("/api/v2/logistics/get_shipping_document_result", payload)
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}
    result_list = body.get("result_list") or []
    if not isinstance(result_list, list):
        result_list = []

    return ShippingDocumentResultResponse(
        endpoint="/api/v2/logistics/get_shipping_document_result",
        request_ids=[str(request_id)] if request_id else [],
        result_list=[item for item in result_list if isinstance(item, dict)],
    )


def download_shipping_document(
    client: ShopeeClient,
    *,
    order_list: list[dict[str, Any]],
    shipping_document_type: str,
    output_path: str | None = None,
) -> ShippingDocumentDownloadResponse:
    if not order_list:
        raise ValueError("order_list must not be empty")
    if not shipping_document_type:
        raise ValueError("shipping_document_type must not be empty")

    payload = {
        "order_list": order_list,
        "shipping_document_type": shipping_document_type,
    }
    api_path = "/api/v2/logistics/download_shipping_document"
    token_shop = client.config.shop_id_int
    token_merchant = client.config.merchant_id_int
    if token_shop or token_merchant:
        client._ensure_token(shop_id=token_shop, merchant_id=token_merchant)
    params = client._common_params(api_path)
    api_url = f"{client.config.api_base}{api_path}"
    response = client.session.post(
        api_url,
        params=params,
        json=payload,
        timeout=client.timeout_seconds,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type")
    if content_type and "application/json" in content_type.lower():
        payload = response.json()
        error = payload.get("error")
        if error not in (None, "", 0, "0"):
            raise ShopeeAPIError(
                message=payload.get("message") or "Shopee API returned error",
                code=str(error),
                request_id=str(payload.get("request_id")) if payload.get("request_id") else None,
            )
        body = payload.get("response") or {}
        if not isinstance(body, dict):
            body = {}
        request_id = payload.get("request_id")
        return ShippingDocumentDownloadResponse(
            endpoint=api_path,
            request_ids=[str(request_id)] if request_id else [],
            content_type=content_type,
            content_length=None,
            output_path=output_path,
            response=body,
        )

    if output_path:
        target = Path(output_path)
    else:
        out_dir = Path("out")
        out_dir.mkdir(parents=True, exist_ok=True)
        ext = "bin"
        if content_type:
            lowered = content_type.lower()
            if "pdf" in lowered:
                ext = "pdf"
            elif "zip" in lowered:
                ext = "zip"
            elif "image/" in lowered:
                ext = lowered.split("/")[-1].split(";")[0] or "img"
        target = out_dir / f"shopee_shipping_document_{int(time.time())}.{ext}"

    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as handle:
        handle.write(response.content)

    return ShippingDocumentDownloadResponse(
        endpoint=api_path,
        request_ids=[],
        content_type=content_type,
        content_length=len(response.content),
        output_path=str(target),
        response=None,
    )


def get_shipping_document_data_info(
    client: ShopeeClient,
    *,
    order_sn: str,
    package_number: str | None = None,
    recipient_address_info: list[dict[str, Any]] | None = None,
) -> ShippingDocumentDataInfoResponse:
    if not order_sn:
        raise ValueError("order_sn must not be empty")

    payload: dict[str, Any] = {"order_sn": order_sn}
    if package_number:
        payload["package_number"] = package_number
    if recipient_address_info:
        payload["recipient_address_info"] = recipient_address_info

    response = client.post("/api/v2/logistics/get_shipping_document_data_info", payload)
    request_id = response.get("request_id")
    body = response.get("response") or {}
    if not isinstance(body, dict):
        body = {}

    return ShippingDocumentDataInfoResponse(
        endpoint="/api/v2/logistics/get_shipping_document_data_info",
        request_ids=[str(request_id)] if request_id else [],
        response=body,
    )
