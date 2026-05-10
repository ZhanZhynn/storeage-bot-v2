import argparse
import json
import sys
from typing import Any

from .client import (ShopeeAPIError, ShopeeClient, ShopeeConfig,
                     ShopeeConfigError)
from .logistics import (
    create_shipping_document,
    download_shipping_document,
    get_shipping_document_data_info,
    get_shipping_document_parameter,
    get_shipping_document_result,
    get_shipping_parameter,
    get_tracking_number,
    ship_order,
    update_shipping_order,
)
from .orders import (
    build_default_order_window,
    cancel_order,
    fetch_orders,
    get_near_sla_orders,
    get_order_items,
    get_package_detail,
    handle_buyer_cancellation,
    search_package_list,
    ship_all_pending_orders,
    split_order,
    split_order_max,
    unsplit_order,
)
from .products import (add_model, add_product, delete_model, delete_product,
                       get_comments, get_item_limit, get_model_list, get_product,
                       get_product_extra_info, get_product_price,
                       get_product_promotion, get_product_stock, get_products,
                       init_tier_variation, reply_comments, search_products,
                       unlist_product, update_model, update_product,
                       update_product_price, update_product_stock,
                       update_tier_variation)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Deterministic Shopee API helper")
    subparsers = parser.add_subparsers(dest="domain", required=True)

    orders = subparsers.add_parser("orders", help="Order domain operations")
    orders_subparsers = orders.add_subparsers(dest="action", required=True)

    orders_get = orders_subparsers.add_parser("get", help="Fetch orders via /api/v2/order/get_order_list")
    orders_get.add_argument("--days", type=int, default=7)
    orders_get.add_argument("--time-from", dest="time_from", type=int, default=None)
    orders_get.add_argument("--time-to", dest="time_to", type=int, default=None)
    orders_get.add_argument(
        "--time-range-field",
        dest="time_range_field",
        choices=("create_time", "update_time"),
        default="create_time",
    )
    orders_get.add_argument("--page-size", dest="page_size", type=int, default=50)
    orders_get.add_argument("--cursor", default=None)
    orders_get.add_argument("--order-status", dest="order_status", default=None)
    orders_get.add_argument("--response-optional-fields", dest="response_optional_fields", default=None)
    orders_get.add_argument("--max-pages", dest="max_pages", type=int, default=10)

    orders_items = orders_subparsers.add_parser(
        "items", help="Fetch order items via /api/v2/order/get_order_detail"
    )
    orders_items.add_argument("--order-sn-list", dest="order_sn_list", required=True)

    orders_cancel = orders_subparsers.add_parser(
        "cancel", help="Cancel order via /api/v2/order/cancel_order"
    )
    orders_cancel.add_argument("--order-sn", dest="order_sn", required=True)
    orders_cancel.add_argument("--cancel-reason", dest="cancel_reason", required=True)
    orders_cancel.add_argument("--item-list", dest="item_list", default=None)

    orders_buyer_cancel = orders_subparsers.add_parser(
        "buyer-cancel", help="Handle buyer cancellation via /api/v2/order/handle_buyer_cancellation"
    )
    orders_buyer_cancel.add_argument("--order-sn", dest="order_sn", required=True)
    orders_buyer_cancel.add_argument("--operation", dest="operation", required=True)

    orders_split = orders_subparsers.add_parser(
        "split", help="Split order via /api/v2/order/split_order"
    )
    orders_split.add_argument("--order-sn", dest="order_sn", required=True)
    orders_split.add_argument("--package-list", dest="package_list", required=True)

    orders_unsplit = orders_subparsers.add_parser(
        "unsplit", help="Undo split via /api/v2/order/unsplit_order"
    )
    orders_unsplit.add_argument("--order-sn", dest="order_sn", required=True)

    orders_split_max = orders_subparsers.add_parser(
        "split-max", help="Split order into max N packages evenly via /api/v2/order/split_order"
    )
    orders_split_max.add_argument("--order-sn", dest="order_sn", required=True)
    orders_split_max.add_argument("--max-packages", dest="max_packages", type=int, default=2)
    orders_split_max.add_argument(
        "--package-number", dest="package_number", required=True,
        help="Existing package number for the order (to fetch item_list)"
    )

    orders_pkg_search = orders_subparsers.add_parser(
        "pkg-search", help="Search packages via /api/v2/order/search_package_list"
    )
    orders_pkg_search.add_argument("--page-size", dest="page_size", type=int, default=50)
    orders_pkg_search.add_argument("--cursor", dest="cursor", default=None)
    orders_pkg_search.add_argument("--filter", dest="filter_payload", default=None)
    orders_pkg_search.add_argument("--sort", dest="sort_payload", default=None)
    orders_pkg_search.add_argument("--max-pages", dest="max_pages", type=int, default=10)

    orders_pkg_detail = orders_subparsers.add_parser(
        "pkg-detail", help="Get package detail via /api/v2/order/get_package_detail"
    )
    orders_pkg_detail.add_argument("--package-number-list", dest="package_number_list", required=True)

    orders_sla = orders_subparsers.add_parser(
        "sla-check", help="Find orders near SLA via ship_by_date and optionally auto-arrange"
    )
    orders_sla.add_argument("--hours", dest="hours", type=int, default=None)
    orders_sla.add_argument("--auto-arrange", dest="auto_arrange", action="store_true")
    orders_sla.add_argument("--max-pages", dest="max_pages", type=int, default=5)

    orders_ship_all = orders_subparsers.add_parser(
        "ship-all", help="Arrange shipment for all pending packages"
    )
    orders_ship_all.add_argument("--max-pages", dest="max_pages", type=int, default=5)

    products = subparsers.add_parser("products", help="Product domain operations")
    products_subparsers = products.add_subparsers(dest="action", required=True)

    products_get = products_subparsers.add_parser("get", help="Fetch items via /api/v2/product/get_item_list")
    products_get.add_argument("--page-size", dest="page_size", type=int, default=50)
    products_get.add_argument("--offset", type=int, default=0)
    products_get.add_argument(
        "--item-status",
        dest="item_status",
        default=None,
        help="Comma-separated list of item statuses (e.g. NORMAL,UNLIST)",
    )
    products_get.add_argument("--update-time-from", dest="update_time_from", type=int, default=None)
    products_get.add_argument("--update-time-to", dest="update_time_to", type=int, default=None)
    products_get.add_argument("--max-pages", dest="max_pages", type=int, default=10)

    products_search = products_subparsers.add_parser("search", help="Search items via /api/v2/product/search_item")
    products_search.add_argument("--page-size", dest="page_size", type=int, default=50)
    products_search.add_argument("--offset", default=None)
    products_search.add_argument("--item-name", dest="item_name", default=None)
    products_search.add_argument("--item-sku", dest="item_sku", default=None)
    products_search.add_argument("--attribute-status", dest="attribute_status", type=int, default=None)
    products_search.add_argument(
        "--item-status",
        dest="item_status",
        default=None,
        help="Comma-separated list of item statuses (e.g. NORMAL,UNLIST)",
    )
    products_search.add_argument("--deboost-only", dest="deboost_only", default=None)
    products_search.add_argument("--max-pages", dest="max_pages", type=int, default=10)

    products_get_one = products_subparsers.add_parser(
        "get-one", help="Fetch product base info via /api/v2/product/get_item_base_info"
    )
    products_get_one.add_argument("--item-id", dest="item_id", type=int, required=True)

    products_models = products_subparsers.add_parser(
        "models", help="Fetch product models via /api/v2/product/get_model_list"
    )
    products_models.add_argument("--item-id", dest="item_id", type=int, required=True)

    products_extra = products_subparsers.add_parser(
        "extra", help="Fetch product extra info via /api/v2/product/get_item_extra_info"
    )
    products_extra.add_argument("--item-id", dest="item_id", type=int, required=True)

    products_promotion = products_subparsers.add_parser(
        "promotion", help="Fetch product promotion info via /api/v2/product/get_item_promotion"
    )
    products_promotion.add_argument("--item-id", dest="item_id", type=int, required=True)

    products_update = products_subparsers.add_parser(
        "update", help="Update product info via /api/v2/product/update_item"
    )
    products_update.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_update.add_argument(
        "--payload",
        dest="payload",
        required=True,
        help="JSON string payload containing fields to update",
    )

    products_add = products_subparsers.add_parser(
        "add", help="Create new product via /api/v2/product/add_item"
    )
    products_add.add_argument(
        "--payload",
        dest="payload",
        required=True,
        help="JSON string payload for add_item",
    )

    products_unlist = products_subparsers.add_parser(
        "unlist", help="Unlist product via /api/v2/product/unlist_item"
    )
    products_unlist.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_unlist.add_argument("--unlist", dest="unlist", action="store_true")
    products_unlist.add_argument("--relist", dest="unlist", action="store_false")
    products_unlist.set_defaults(unlist=True)

    products_delete = products_subparsers.add_parser(
        "delete", help="Delete product via /api/v2/product/delete_item"
    )
    products_delete.add_argument("--item-id", dest="item_id", type=int, required=True)

    products_tier_init = products_subparsers.add_parser(
        "tier-init", help="Init tier variation via /api/v2/product/init_tier_variation"
    )
    products_tier_init.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_tier_init.add_argument("--tier-variation", dest="tier_variation", required=True)
    products_tier_init.add_argument("--model-list", dest="model_list", required=True)

    products_tier_update = products_subparsers.add_parser(
        "tier-update", help="Update tier variation via /api/v2/product/update_tier_variation"
    )
    products_tier_update.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_tier_update.add_argument("--tier-variation", dest="tier_variation", required=True)
    products_tier_update.add_argument("--model-list", dest="model_list", default=None)

    products_model_add = products_subparsers.add_parser(
        "model-add", help="Add model via /api/v2/product/add_model"
    )
    products_model_add.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_model_add.add_argument("--model-list", dest="model_list", required=True)

    products_model_update = products_subparsers.add_parser(
        "model-update", help="Update model via /api/v2/product/update_model"
    )
    products_model_update.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_model_update.add_argument("--model-list", dest="model_list", required=True)

    products_model_delete = products_subparsers.add_parser(
        "model-delete", help="Delete model via /api/v2/product/delete_model"
    )
    products_model_delete.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_model_delete.add_argument("--model-id-list", dest="model_id_list", required=True)

    products_price_get = products_subparsers.add_parser(
        "price-get", help="Get product price via get_item_base_info/get_model_list"
    )
    products_price_get.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_price_get.add_argument("--has-model", dest="has_model", action="store_true")
    products_price_get.add_argument("--no-model", dest="has_model", action="store_false")
    products_price_get.set_defaults(has_model=False)

    products_stock_get = products_subparsers.add_parser(
        "stock-get", help="Get product stock via get_item_base_info/get_model_list"
    )
    products_stock_get.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_stock_get.add_argument("--has-model", dest="has_model", action="store_true")
    products_stock_get.add_argument("--no-model", dest="has_model", action="store_false")
    products_stock_get.set_defaults(has_model=False)

    products_price_update = products_subparsers.add_parser(
        "price-update", help="Update product price via /api/v2/product/update_price"
    )
    products_price_update.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_price_update.add_argument("--price-list", dest="price_list", required=True)

    products_stock_update = products_subparsers.add_parser(
        "stock-update", help="Update product stock via /api/v2/product/update_stock"
    )
    products_stock_update.add_argument("--item-id", dest="item_id", type=int, required=True)
    products_stock_update.add_argument("--stock-list", dest="stock_list", required=True)

    products_limit = products_subparsers.add_parser(
        "limit", help="Get item limits via /api/v2/product/get_item_limit"
    )
    products_limit.add_argument("--item-id", dest="item_id", type=int, required=True)

    products_comments = products_subparsers.add_parser(
        "comments", help="Get comments via /api/v2/product/get_comment"
    )
    products_comments.add_argument("--page-size", dest="page_size", type=int, default=50)
    products_comments.add_argument("--cursor", default="")
    products_comments.add_argument("--item-id", dest="item_id", type=int, default=None)
    products_comments.add_argument("--comment-id", dest="comment_id", type=int, default=None)
    products_comments.add_argument("--max-pages", dest="max_pages", type=int, default=10)

    products_reply = products_subparsers.add_parser(
        "reply", help="Reply comments via /api/v2/product/reply_comment"
    )
    products_reply.add_argument("--comment-list", dest="comment_list", required=True)

    logistics = subparsers.add_parser("logistics", help="Logistics domain operations")
    logistics_subparsers = logistics.add_subparsers(dest="action", required=True)

    logistics_param = logistics_subparsers.add_parser(
        "ship-param", help="Get shipping parameters via /api/v2/logistics/get_shipping_parameter"
    )
    logistics_param.add_argument("--order-sn", dest="order_sn", required=True)
    logistics_param.add_argument("--package-number", dest="package_number", default=None)

    logistics_ship = logistics_subparsers.add_parser(
        "ship", help="Arrange shipment via /api/v2/logistics/ship_order"
    )
    logistics_ship.add_argument("--order-sn", dest="order_sn", required=True)
    logistics_ship.add_argument("--package-number", dest="package_number", default=None)
    logistics_ship.add_argument("--pickup", dest="pickup", default=None)
    logistics_ship.add_argument("--dropoff", dest="dropoff", default=None)
    logistics_ship.add_argument("--non-integrated", dest="non_integrated", default=None)

    logistics_update = logistics_subparsers.add_parser(
        "ship-update", help="Update shipment via /api/v2/logistics/update_shipping_order"
    )
    logistics_update.add_argument("--order-sn", dest="order_sn", required=True)
    logistics_update.add_argument("--address-id", dest="address_id", type=int, required=True)
    logistics_update.add_argument("--pickup-time-id", dest="pickup_time_id", required=True)
    logistics_update.add_argument("--package-number", dest="package_number", default=None)

    logistics_tracking = logistics_subparsers.add_parser(
        "tracking", help="Get tracking number via /api/v2/logistics/get_tracking_number"
    )
    logistics_tracking.add_argument("--order-sn", dest="order_sn", required=True)
    logistics_tracking.add_argument("--package-number", dest="package_number", default=None)
    logistics_tracking.add_argument(
        "--response-optional-fields", dest="response_optional_fields", default=None
    )

    logistics_doc_param = logistics_subparsers.add_parser(
        "doc-param",
        help="Get shipping document parameter via /api/v2/logistics/get_shipping_document_parameter",
    )
    logistics_doc_param.add_argument("--order-list", dest="order_list", required=True)

    logistics_doc_create = logistics_subparsers.add_parser(
        "doc-create",
        help="Create shipping document via /api/v2/logistics/create_shipping_document",
    )
    logistics_doc_create.add_argument("--order-list", dest="order_list", required=True)
    logistics_doc_create.add_argument(
        "--shipping-document-type", dest="shipping_document_type", default=None
    )

    logistics_doc_status = logistics_subparsers.add_parser(
        "doc-status",
        help="Get shipping document status via /api/v2/logistics/get_shipping_document_result",
    )
    logistics_doc_status.add_argument("--order-list", dest="order_list", required=True)
    logistics_doc_status.add_argument(
        "--shipping-document-type", dest="shipping_document_type", default=None
    )

    logistics_doc_download = logistics_subparsers.add_parser(
        "doc-download",
        help="Download shipping document via /api/v2/logistics/download_shipping_document",
    )
    logistics_doc_download.add_argument("--order-list", dest="order_list", required=True)
    logistics_doc_download.add_argument(
        "--shipping-document-type", dest="shipping_document_type", required=True
    )
    logistics_doc_download.add_argument("--output", dest="output_path", default=None)

    logistics_doc_data = logistics_subparsers.add_parser(
        "doc-data",
        help="Get shipping document data via /api/v2/logistics/get_shipping_document_data_info",
    )
    logistics_doc_data.add_argument("--order-sn", dest="order_sn", required=True)
    logistics_doc_data.add_argument("--package-number", dest="package_number", default=None)
    logistics_doc_data.add_argument(
        "--recipient-address-info", dest="recipient_address_info", default=None
    )

    auth = subparsers.add_parser("auth", help="Authorization helpers")
    auth_subparsers = auth.add_subparsers(dest="action", required=True)

    auth_url = auth_subparsers.add_parser("url", help="Build authorization URL")
    auth_url.add_argument("--redirect", required=True)

    token_get = auth_subparsers.add_parser("token-get", help="Exchange code for tokens")
    token_get.add_argument("--code", required=True)
    token_get.add_argument("--shop-id", dest="shop_id", default=None)
    token_get.add_argument("--main-account-id", dest="main_account_id", default=None)

    token_refresh = auth_subparsers.add_parser("token-refresh", help="Refresh access token")
    token_refresh.add_argument("--refresh-token", dest="refresh_token", required=True)
    token_refresh.add_argument("--shop-id", dest="shop_id", default=None)
    token_refresh.add_argument("--merchant-id", dest="merchant_id", default=None)

    return parser


def _emit(payload: dict[str, Any], ok: bool, status: str = "ok") -> int:
    body = {
        "ok": ok,
        "status": status,
        **payload,
    }
    sys.stdout.write(json.dumps(body, ensure_ascii=True) + "\n")
    return 0 if ok else 1


def _with_client() -> ShopeeClient:
    return ShopeeClient(ShopeeConfig.from_env())


def _handle_orders_get(args: argparse.Namespace) -> int:
    time_from = args.time_from
    time_to = args.time_to
    if time_from is None or time_to is None:
        time_from, time_to = build_default_order_window(args.days)

    result = fetch_orders(
        _with_client(),
        time_from=time_from,
        time_to=time_to,
        time_range_field=args.time_range_field,
        page_size=args.page_size,
        cursor=args.cursor,
        order_status=args.order_status,
        response_optional_fields=args.response_optional_fields,
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "orders",
            "action": "get",
            "filters": {
                "time_from": time_from,
                "time_to": time_to,
                "time_range_field": args.time_range_field,
                "page_size": args.page_size,
                "cursor": args.cursor,
                "order_status": args.order_status,
                "response_optional_fields": args.response_optional_fields,
                "max_pages": args.max_pages,
            },
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_items(args: argparse.Namespace) -> int:
    order_sn_list = [sn.strip() for sn in args.order_sn_list.split(",") if sn.strip()]
    result = get_order_items(_with_client(), order_sn_list=order_sn_list)
    return _emit(
        {
            "domain": "orders",
            "action": "items",
            "order_sn_list": order_sn_list,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_cancel(args: argparse.Namespace) -> int:
    item_list = json.loads(args.item_list) if args.item_list else None
    result = cancel_order(
        _with_client(),
        order_sn=args.order_sn,
        cancel_reason=args.cancel_reason,
        item_list=item_list,
    )
    return _emit(
        {
            "domain": "orders",
            "action": "cancel",
            "order_sn": args.order_sn,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_buyer_cancel(args: argparse.Namespace) -> int:
    result = handle_buyer_cancellation(
        _with_client(),
        order_sn=args.order_sn,
        operation=args.operation,
    )
    return _emit(
        {
            "domain": "orders",
            "action": "buyer-cancel",
            "order_sn": args.order_sn,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_split(args: argparse.Namespace) -> int:
    package_list = json.loads(args.package_list)
    result = split_order(
        _with_client(),
        order_sn=args.order_sn,
        package_list=package_list,
    )
    return _emit(
        {
            "domain": "orders",
            "action": "split",
            "order_sn": args.order_sn,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_unsplit(args: argparse.Namespace) -> int:
    result = unsplit_order(_with_client(), order_sn=args.order_sn)
    return _emit(
        {
            "domain": "orders",
            "action": "unsplit",
            "order_sn": args.order_sn,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_split_max(args: argparse.Namespace) -> int:
    detail = get_package_detail(_with_client(), package_number_list=[args.package_number])
    packages = detail.packages
    if not packages:
        return _emit(
            {"error": f"Package {args.package_number} not found"}, ok=False, status="not_found"
        )
    order_sn = packages[0].get("order_sn") or args.order_sn
    item_list = [i for i in packages[0].get("item_list", []) if isinstance(i, dict)]
    if not item_list:
        return _emit(
            {"error": f"No items found in package {args.package_number}"}, ok=False, status="no_items"
        )
    total_items = len(item_list)
    items_per_pkg = total_items // args.max_packages
    remainder = total_items % args.max_packages

    package_list: list[dict[str, Any]] = []
    idx = 0
    for pkg_idx in range(args.max_packages):
        count = items_per_pkg + (1 if pkg_idx < remainder else 0)
        package_items = item_list[idx : idx + count]
        idx += count
        package_list.append({"item_list": package_items})
        if idx >= total_items:
            break

    result = split_order(_with_client(), order_sn=order_sn, package_list=package_list)
    return _emit(
        {
            "domain": "orders",
            "action": "split-max",
            "order_sn": order_sn,
            "max_packages": args.max_packages,
            "package_list": package_list,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_pkg_search(args: argparse.Namespace) -> int:
    filter_payload = json.loads(args.filter_payload) if args.filter_payload else None
    sort_payload = json.loads(args.sort_payload) if args.sort_payload else None
    result = search_package_list(
        _with_client(),
        page_size=args.page_size,
        cursor=args.cursor,
        filter_payload=filter_payload,
        sort_payload=sort_payload,
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "orders",
            "action": "pkg-search",
            "filters": {
                "page_size": args.page_size,
                "cursor": args.cursor,
                "filter": filter_payload,
                "sort": sort_payload,
                "max_pages": args.max_pages,
            },
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_pkg_detail(args: argparse.Namespace) -> int:
    package_number_list = [
        value.strip() for value in args.package_number_list.split(",") if value.strip()
    ]
    result = get_package_detail(_with_client(), package_number_list=package_number_list)
    return _emit(
        {
            "domain": "orders",
            "action": "pkg-detail",
            "package_number_list": package_number_list,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_sla_check(args: argparse.Namespace) -> int:
    result = get_near_sla_orders(
        _with_client(),
        hours_threshold=args.hours,
        auto_arrange=args.auto_arrange,
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "orders",
            "action": "sla-check",
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_orders_ship_all(args: argparse.Namespace) -> int:
    result = ship_all_pending_orders(_with_client(), max_pages=args.max_pages)
    return _emit(
        {
            "domain": "orders",
            "action": "ship-all",
            "max_pages": args.max_pages,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_get(args: argparse.Namespace) -> int:
    item_status = None
    if args.item_status:
        item_status = [status.strip() for status in args.item_status.split(",") if status.strip()]
    result = get_products(
        _with_client(),
        page_size=args.page_size,
        offset=args.offset,
        item_status=item_status,
        update_time_from=args.update_time_from,
        update_time_to=args.update_time_to,
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "products",
            "action": "get",
            "filters": {
                "page_size": args.page_size,
                "offset": args.offset,
                "item_status": item_status,
                "update_time_from": args.update_time_from,
                "update_time_to": args.update_time_to,
                "max_pages": args.max_pages,
            },
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_search(args: argparse.Namespace) -> int:
    def _to_bool(value: Any) -> bool | None:
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in ("true", "1", "yes", "y"):
            return True
        if normalized in ("false", "0", "no", "n"):
            return False
        return None

    item_status = None
    if args.item_status:
        item_status = [status.strip() for status in args.item_status.split(",") if status.strip()]

    result = search_products(
        _with_client(),
        page_size=args.page_size,
        offset=args.offset,
        item_name=args.item_name,
        item_sku=args.item_sku,
        attribute_status=args.attribute_status,
        item_status=item_status,
        deboost_only=_to_bool(args.deboost_only),
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "products",
            "action": "search",
            "filters": {
                "page_size": args.page_size,
                "offset": args.offset,
                "item_name": args.item_name,
                "item_sku": args.item_sku,
                "attribute_status": args.attribute_status,
                "item_status": item_status,
                "deboost_only": args.deboost_only,
                "max_pages": args.max_pages,
            },
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_get_one(args: argparse.Namespace) -> int:
    result = get_product(_with_client(), item_id=args.item_id)
    return _emit(
        {
            "domain": "products",
            "action": "get-one",
            "item_id": args.item_id,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_models(args: argparse.Namespace) -> int:
    result = get_model_list(_with_client(), item_id=args.item_id)
    return _emit(
        {
            "domain": "products",
            "action": "models",
            "item_id": args.item_id,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_extra(args: argparse.Namespace) -> int:
    result = get_product_extra_info(_with_client(), item_id=args.item_id)
    return _emit(
        {
            "domain": "products",
            "action": "extra",
            "item_id": args.item_id,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_promotion(args: argparse.Namespace) -> int:
    result = get_product_promotion(_with_client(), item_id=args.item_id)
    return _emit(
        {
            "domain": "products",
            "action": "promotion",
            "item_id": args.item_id,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_update(args: argparse.Namespace) -> int:
    update_payload = json.loads(args.payload)
    result = update_product(_with_client(), item_id=args.item_id, update_payload=update_payload)
    return _emit(
        {
            "domain": "products",
            "action": "update",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_add(args: argparse.Namespace) -> int:
    payload = json.loads(args.payload)
    result = add_product(_with_client(), payload=payload)
    return _emit(
        {
            "domain": "products",
            "action": "add",
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_unlist(args: argparse.Namespace) -> int:
    result = unlist_product(_with_client(), item_id=args.item_id, unlist=args.unlist)
    return _emit(
        {
            "domain": "products",
            "action": "unlist",
            "item_id": args.item_id,
            "unlist": args.unlist,
            "response": result,
        },
        ok=True,
    )


def _handle_products_delete(args: argparse.Namespace) -> int:
    result = delete_product(_with_client(), item_id=args.item_id)
    return _emit(
        {
            "domain": "products",
            "action": "delete",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_tier_init(args: argparse.Namespace) -> int:
    tier_variation = json.loads(args.tier_variation)
    model_list = json.loads(args.model_list)
    result = init_tier_variation(
        _with_client(),
        item_id=args.item_id,
        tier_variation=tier_variation,
        model_list=model_list,
    )
    return _emit(
        {
            "domain": "products",
            "action": "tier-init",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_tier_update(args: argparse.Namespace) -> int:
    tier_variation = json.loads(args.tier_variation)
    model_list = json.loads(args.model_list) if args.model_list is not None else None
    result = update_tier_variation(
        _with_client(),
        item_id=args.item_id,
        tier_variation=tier_variation,
        model_list=model_list,
    )
    return _emit(
        {
            "domain": "products",
            "action": "tier-update",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_model_add(args: argparse.Namespace) -> int:
    model_list = json.loads(args.model_list)
    result = add_model(_with_client(), item_id=args.item_id, model_list=model_list)
    return _emit(
        {
            "domain": "products",
            "action": "model-add",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_model_update(args: argparse.Namespace) -> int:
    model_list = json.loads(args.model_list)
    result = update_model(_with_client(), item_id=args.item_id, model_list=model_list)
    return _emit(
        {
            "domain": "products",
            "action": "model-update",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_model_delete(args: argparse.Namespace) -> int:
    model_id_list = json.loads(args.model_id_list)
    result = delete_model(_with_client(), item_id=args.item_id, model_id_list=model_id_list)
    return _emit(
        {
            "domain": "products",
            "action": "model-delete",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_price_get(args: argparse.Namespace) -> int:
    result = get_product_price(_with_client(), item_id=args.item_id, has_model=args.has_model)
    return _emit(
        {
            "domain": "products",
            "action": "price-get",
            "item_id": args.item_id,
            "has_model": args.has_model,
            "response": result,
        },
        ok=True,
    )


def _handle_products_stock_get(args: argparse.Namespace) -> int:
    result = get_product_stock(_with_client(), item_id=args.item_id, has_model=args.has_model)
    return _emit(
        {
            "domain": "products",
            "action": "stock-get",
            "item_id": args.item_id,
            "has_model": args.has_model,
            "response": result,
        },
        ok=True,
    )


def _handle_products_price_update(args: argparse.Namespace) -> int:
    price_list = json.loads(args.price_list)
    result = update_product_price(_with_client(), item_id=args.item_id, price_list=price_list)
    return _emit(
        {
            "domain": "products",
            "action": "price-update",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_stock_update(args: argparse.Namespace) -> int:
    stock_list = json.loads(args.stock_list)
    result = update_product_stock(_with_client(), item_id=args.item_id, stock_list=stock_list)
    return _emit(
        {
            "domain": "products",
            "action": "stock-update",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_limit(args: argparse.Namespace) -> int:
    result = get_item_limit(_with_client(), item_id=args.item_id)
    return _emit(
        {
            "domain": "products",
            "action": "limit",
            "item_id": args.item_id,
            "response": result,
        },
        ok=True,
    )


def _handle_products_comments(args: argparse.Namespace) -> int:
    result = get_comments(
        _with_client(),
        page_size=args.page_size,
        cursor=args.cursor,
        item_id=args.item_id,
        comment_id=args.comment_id,
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "products",
            "action": "comments",
            "filters": {
                "page_size": args.page_size,
                "cursor": args.cursor,
                "item_id": args.item_id,
                "comment_id": args.comment_id,
                "max_pages": args.max_pages,
            },
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_products_reply(args: argparse.Namespace) -> int:
    comment_list = json.loads(args.comment_list)
    result = reply_comments(_with_client(), comment_list=comment_list)
    return _emit(
        {
            "domain": "products",
            "action": "reply",
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_ship_param(args: argparse.Namespace) -> int:
    result = get_shipping_parameter(
        _with_client(),
        order_sn=args.order_sn,
        package_number=args.package_number,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "ship-param",
            "order_sn": args.order_sn,
            "package_number": args.package_number,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_ship(args: argparse.Namespace) -> int:
    pickup = json.loads(args.pickup) if args.pickup else None
    dropoff = json.loads(args.dropoff) if args.dropoff else None
    non_integrated = json.loads(args.non_integrated) if args.non_integrated else None
    result = ship_order(
        _with_client(),
        order_sn=args.order_sn,
        package_number=args.package_number,
        pickup=pickup,
        dropoff=dropoff,
        non_integrated=non_integrated,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "ship",
            "order_sn": args.order_sn,
            "package_number": args.package_number,
            "method": "pickup" if pickup is not None else "dropoff" if dropoff is not None else "non_integrated",
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_ship_update(args: argparse.Namespace) -> int:
    result = update_shipping_order(
        _with_client(),
        order_sn=args.order_sn,
        address_id=args.address_id,
        pickup_time_id=args.pickup_time_id,
        package_number=args.package_number,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "ship-update",
            "order_sn": args.order_sn,
            "package_number": args.package_number,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_tracking(args: argparse.Namespace) -> int:
    result = get_tracking_number(
        _with_client(),
        order_sn=args.order_sn,
        package_number=args.package_number,
        response_optional_fields=args.response_optional_fields,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "tracking",
            "order_sn": args.order_sn,
            "package_number": args.package_number,
            "response_optional_fields": args.response_optional_fields,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_doc_param(args: argparse.Namespace) -> int:
    order_list = json.loads(args.order_list)
    result = get_shipping_document_parameter(_with_client(), order_list=order_list)
    return _emit(
        {
            "domain": "logistics",
            "action": "doc-param",
            "order_list": order_list,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_doc_create(args: argparse.Namespace) -> int:
    order_list = json.loads(args.order_list)
    result = create_shipping_document(
        _with_client(),
        order_list=order_list,
        shipping_document_type=args.shipping_document_type,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "doc-create",
            "order_list": order_list,
            "shipping_document_type": args.shipping_document_type,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_doc_status(args: argparse.Namespace) -> int:
    order_list = json.loads(args.order_list)
    result = get_shipping_document_result(
        _with_client(),
        order_list=order_list,
        shipping_document_type=args.shipping_document_type,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "doc-status",
            "order_list": order_list,
            "shipping_document_type": args.shipping_document_type,
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_doc_download(args: argparse.Namespace) -> int:
    order_list = json.loads(args.order_list)
    result = download_shipping_document(
        _with_client(),
        order_list=order_list,
        shipping_document_type=args.shipping_document_type,
        output_path=args.output_path,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "doc-download",
            "order_list": order_list,
            "shipping_document_type": args.shipping_document_type,
            "output_path": args.output_path,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_logistics_doc_data(args: argparse.Namespace) -> int:
    recipient_address_info = (
        json.loads(args.recipient_address_info) if args.recipient_address_info else None
    )
    result = get_shipping_document_data_info(
        _with_client(),
        order_sn=args.order_sn,
        package_number=args.package_number,
        recipient_address_info=recipient_address_info,
    )
    return _emit(
        {
            "domain": "logistics",
            "action": "doc-data",
            "order_sn": args.order_sn,
            "package_number": args.package_number,
            "response": result.model_dump(),
        },
        ok=True,
    )


def _handle_returns_list(args: argparse.Namespace) -> int:
    result = get_return_list(
        _with_client(),
        page_size=args.page_size,
        cursor=args.cursor,
        create_time_from=args.create_time_from,
        create_time_to=args.create_time_to,
        update_time_from=args.update_time_from,
        update_time_to=args.update_time_to,
        status=args.status,
        max_pages=args.max_pages,
    )
    return _emit(
        {
            "domain": "returns-refunds",
            "action": "list",
            "filters": {
                "page_size": args.page_size,
                "cursor": args.cursor,
                "create_time_from": args.create_time_from,
                "create_time_to": args.create_time_to,
                "update_time_from": args.update_time_from,
                "update_time_to": args.update_time_to,
                "status": args.status,
                "max_pages": args.max_pages,
            },
            **result.model_dump(),
        },
        ok=True,
    )


def _handle_auth_url(args: argparse.Namespace) -> int:
    url = _with_client().build_auth_url(args.redirect)
    return _emit({"auth_url": url}, ok=True)


def _handle_token_get(args: argparse.Namespace) -> int:
    result = _with_client().get_access_token(
        args.code,
        shop_id=args.shop_id,
        main_account_id=args.main_account_id,
    )
    return _emit({"response": result}, ok=True)


def _handle_token_refresh(args: argparse.Namespace) -> int:
    result = _with_client().refresh_access_token(
        args.refresh_token,
        shop_id=args.shop_id,
        merchant_id=args.merchant_id,
    )
    return _emit({"response": result}, ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    try:
        if args.domain == "orders" and args.action == "get":
            return _handle_orders_get(args)
        if args.domain == "orders" and args.action == "items":
            return _handle_orders_items(args)
        if args.domain == "orders" and args.action == "cancel":
            return _handle_orders_cancel(args)
        if args.domain == "orders" and args.action == "buyer-cancel":
            return _handle_orders_buyer_cancel(args)
        if args.domain == "orders" and args.action == "split":
            return _handle_orders_split(args)
        if args.domain == "orders" and args.action == "unsplit":
            return _handle_orders_unsplit(args)
        if args.domain == "orders" and args.action == "split-max":
            return _handle_orders_split_max(args)
        if args.domain == "orders" and args.action == "pkg-search":
            return _handle_orders_pkg_search(args)
        if args.domain == "orders" and args.action == "pkg-detail":
            return _handle_orders_pkg_detail(args)
        if args.domain == "orders" and args.action == "sla-check":
            return _handle_orders_sla_check(args)
        if args.domain == "orders" and args.action == "ship-all":
            return _handle_orders_ship_all(args)
        if args.domain == "products" and args.action == "get":
            return _handle_products_get(args)
        if args.domain == "products" and args.action == "search":
            return _handle_products_search(args)
        if args.domain == "products" and args.action == "get-one":
            return _handle_products_get_one(args)
        if args.domain == "products" and args.action == "models":
            return _handle_products_models(args)
        if args.domain == "products" and args.action == "extra":
            return _handle_products_extra(args)
        if args.domain == "products" and args.action == "promotion":
            return _handle_products_promotion(args)
        if args.domain == "products" and args.action == "update":
            return _handle_products_update(args)
        if args.domain == "products" and args.action == "add":
            return _handle_products_add(args)
        if args.domain == "products" and args.action == "unlist":
            return _handle_products_unlist(args)
        if args.domain == "products" and args.action == "delete":
            return _handle_products_delete(args)
        if args.domain == "products" and args.action == "tier-init":
            return _handle_products_tier_init(args)
        if args.domain == "products" and args.action == "tier-update":
            return _handle_products_tier_update(args)
        if args.domain == "products" and args.action == "model-add":
            return _handle_products_model_add(args)
        if args.domain == "products" and args.action == "model-update":
            return _handle_products_model_update(args)
        if args.domain == "products" and args.action == "model-delete":
            return _handle_products_model_delete(args)
        if args.domain == "products" and args.action == "price-get":
            return _handle_products_price_get(args)
        if args.domain == "products" and args.action == "stock-get":
            return _handle_products_stock_get(args)
        if args.domain == "products" and args.action == "price-update":
            return _handle_products_price_update(args)
        if args.domain == "products" and args.action == "stock-update":
            return _handle_products_stock_update(args)
        if args.domain == "products" and args.action == "limit":
            return _handle_products_limit(args)
        if args.domain == "products" and args.action == "comments":
            return _handle_products_comments(args)
        if args.domain == "products" and args.action == "reply":
            return _handle_products_reply(args)
        if args.domain == "logistics" and args.action == "ship-param":
            return _handle_logistics_ship_param(args)
        if args.domain == "logistics" and args.action == "ship":
            return _handle_logistics_ship(args)
        if args.domain == "logistics" and args.action == "ship-update":
            return _handle_logistics_ship_update(args)
        if args.domain == "logistics" and args.action == "tracking":
            return _handle_logistics_tracking(args)
        if args.domain == "logistics" and args.action == "doc-param":
            return _handle_logistics_doc_param(args)
        if args.domain == "logistics" and args.action == "doc-create":
            return _handle_logistics_doc_create(args)
        if args.domain == "logistics" and args.action == "doc-status":
            return _handle_logistics_doc_status(args)
        if args.domain == "logistics" and args.action == "doc-download":
            return _handle_logistics_doc_download(args)
        if args.domain == "logistics" and args.action == "doc-data":
            return _handle_logistics_doc_data(args)
        if args.domain == "returns-refunds" and args.action == "list":
            return _handle_returns_list(args)
        if args.domain == "auth" and args.action == "url":
            return _handle_auth_url(args)
        if args.domain == "auth" and args.action == "token-get":
            return _handle_token_get(args)
        if args.domain == "auth" and args.action == "token-refresh":
            return _handle_token_refresh(args)
        return _emit({"error": "Unsupported command"}, ok=False, status="invalid_command")
    except ShopeeConfigError as err:
        return _emit({"error": str(err)}, ok=False, status="config_error")
    except ShopeeAPIError as err:
        return _emit(
            {
                "error": str(err),
                "api_code": err.code,
                "request_id": err.request_id,
            },
            ok=False,
            status="api_error",
        )
    except Exception as err:
        return _emit({"error": str(err)}, ok=False, status="runtime_error")


if __name__ == "__main__":
    raise SystemExit(main())
