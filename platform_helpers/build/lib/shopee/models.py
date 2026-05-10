from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ShopeeBaseResponse(BaseModel):
    endpoint: str
    request_ids: list[str]

    model_config = ConfigDict(extra="allow")


class OrdersResponse(ShopeeBaseResponse):
    total_fetched: int
    pages_fetched: int
    has_more: bool
    next_cursor: str | None
    orders: list[dict[str, Any]]


class OrderItemsResponse(ShopeeBaseResponse):
    total_fetched: int
    order_ids: list[str]
    items: list[dict[str, Any]]


class OrderActionResponse(ShopeeBaseResponse):
    response: dict[str, Any]


class OrderSplitResponse(ShopeeBaseResponse):
    order_sn: str | None
    package_list: list[dict[str, Any]]


class PackageListResponse(ShopeeBaseResponse):
    total_fetched: int
    pages_fetched: int
    has_more: bool
    next_cursor: str | None
    total_count: int | None
    packages: list[dict[str, Any]]


class PackageDetailResponse(ShopeeBaseResponse):
    packages: list[dict[str, Any]]


class NearSLAOrderItem(BaseModel):
    order_sn: str
    package_number: str | None
    logistics_channel_id: int | None
    ship_by_date: int | None
    hours_to_ship: float | None
    days_to_ship: int | None
    fulfillment_status: str | None
    is_shipment_arranged: bool
    is_split_up: bool
    status_info_tag: dict[str, Any] | None
    shippable: bool
    shippable_reason: str | None
    auto_arranged: bool
    ship_error: str | None


class NearSLAOrdersResponse(ShopeeBaseResponse):
    sla_threshold_hours: int
    total_checked: int
    near_sla_count: int
    auto_arranged_count: int
    error_count: int
    orders: list[NearSLAOrderItem]


class ShipAllOrdersResponse(ShopeeBaseResponse):
    total_checked: int
    auto_arranged_count: int
    error_count: int
    orders: list[NearSLAOrderItem]


class ShippingParameterResponse(ShopeeBaseResponse):
    order_sn: str
    package_number: str | None
    response: dict[str, Any]


class ShippingOrderResponse(ShopeeBaseResponse):
    response: dict[str, Any]


class TrackingNumberResponse(ShopeeBaseResponse):
    response: dict[str, Any]


class ShippingDocumentParameterResponse(ShopeeBaseResponse):
    result_list: list[dict[str, Any]]
    warning: list[str] | None


class ShippingDocumentResultResponse(ShopeeBaseResponse):
    result_list: list[dict[str, Any]]


class ShippingDocumentDownloadResponse(ShopeeBaseResponse):
    content_type: str | None
    content_length: int | None
    output_path: str | None
    response: dict[str, Any] | None


class ShippingDocumentDataInfoResponse(ShopeeBaseResponse):
    response: dict[str, Any]


class ProductsResponse(ShopeeBaseResponse):
    total_fetched: int
    pages_fetched: int
    has_more: bool
    next_offset: int | None
    items: list[dict[str, Any]]


class ProductItemResponse(ShopeeBaseResponse):
    item_id: int
    has_model: bool
    item_base_info: dict[str, Any]
    models: list[dict[str, Any]]


class ModelListResponse(ShopeeBaseResponse):
    item_id: int
    models: list[dict[str, Any]]


class ProductExtraInfoResponse(ShopeeBaseResponse):
    item_id: int
    extra_info: dict[str, Any]


class ProductPromotionResponse(ShopeeBaseResponse):
    item_id: int
    promotions: list[dict[str, Any]]


class ProductCreateResponse(ShopeeBaseResponse):
    item_id: int | None
    response: dict[str, Any]


class CommentsResponse(ShopeeBaseResponse):
    total_fetched: int
    pages_fetched: int
    has_more: bool
    next_cursor: str | None
    comments: list[dict[str, Any]]


class ReplyCommentsResponse(ShopeeBaseResponse):
    result_list: list[dict[str, Any]]
    warning: list[str] | None
