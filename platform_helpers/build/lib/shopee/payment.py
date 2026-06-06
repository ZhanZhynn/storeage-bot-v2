"""Shopee payment domain helpers: escrow, payout, billing.

Endpoints wrapped:
  * get_escrow_list              GET  /api/v2/payment/get_escrow_list
  * get_escrow_detail            GET  /api/v2/payment/get_escrow_detail
  * get_escrow_detail_batch      POST /api/v2/payment/get_escrow_detail_batch
  * get_payout_info              GET  /api/v2/payment/get_payout_info
  * get_payout_detail            GET  /api/v2/payment/get_payout_detail
  * get_billing_transaction_info POST /api/v2/payment/get_billing_transaction_info

In addition, `compute_order_payout_breakdown` walks a single
`escrow_detail` payload and returns a structured per-order + per-item
report of revenue, fees, discounts, taxes, shipping, payout, and
seller profit. All region-conditional fee fields default to 0 and
the helper records human-readable `notes` whenever a known fee is
absent so the report is self-explanatory.
"""

from __future__ import annotations

from typing import Any, Sequence

from .client import ShopeeClient
from .models import (
    BillingTransactionInfoResponse,
    EscrowDetailBatchResponse,
    EscrowDetailResponse,
    EscrowListResponse,
    PayoutDetailResponse,
    PayoutInfoResponse,
)


# ---------------------------------------------------------------------------
# Endpoint wrappers
# ---------------------------------------------------------------------------


def get_escrow_list(
    client: ShopeeClient,
    *,
    release_time_from: int,
    release_time_to: int,
    page_size: int = 40,
    page_no: int = 1,
    max_pages: int = 10,
) -> EscrowListResponse:
    """List orders whose escrow has been released in a window.

    `release_time_from` / `release_time_to` are unix timestamps filtering
    by the escrow release time (when funds became withdrawable), NOT by
    order create/update time. Page-based pagination.
    """
    if release_time_from <= 0 or release_time_to <= 0:
        raise ValueError("release_time_from and release_time_to must be positive unix timestamps")
    if release_time_from > release_time_to:
        raise ValueError("release_time_from must be <= release_time_to")
    if page_size <= 0 or page_size > 100:
        raise ValueError("page_size must be in (0, 100]")
    if page_no <= 0:
        raise ValueError("page_no must be > 0")
    if max_pages <= 0:
        raise ValueError("max_pages must be > 0")

    collected: list[dict[str, Any]] = []
    request_ids: list[str] = []
    current_page = page_no
    has_more = False
    next_cursor: str | None = None

    for _ in range(max_pages):
        payload = client.get(
            "/api/v2/payment/get_escrow_list",
            {
                "release_time_from": release_time_from,
                "release_time_to": release_time_to,
                "page_size": page_size,
                "page_no": current_page,
            },
        )
        request_id = payload.get("request_id")
        if request_id:
            request_ids.append(str(request_id))

        response = payload.get("response") or {}
        if not isinstance(response, dict):
            response = {}
        records = response.get("escrow_list") or []
        if not isinstance(records, list):
            records = []
        collected.extend([item for item in records if isinstance(item, dict)])

        has_more = bool(response.get("more"))
        next_cursor_value = response.get("next_cursor")
        if isinstance(next_cursor_value, str) and next_cursor_value:
            next_cursor = next_cursor_value
        else:
            next_cursor = None
        if not has_more:
            break
        current_page += 1

    return EscrowListResponse(
        endpoint="/api/v2/payment/get_escrow_list",
        request_ids=request_ids,
        total_fetched=len(collected),
        pages_fetched=len(request_ids),
        has_more=has_more,
        next_cursor=next_cursor,
        escrow_list=collected,
    )


def get_escrow_detail(
    client: ShopeeClient,
    *,
    order_sn: str,
) -> EscrowDetailResponse:
    """Fetch full accounting detail for a single order.

    Returns the canonical `escrow_amount` (expected payout) plus every
    discount, voucher, coin offset, shipping component, tax, fee, and
    per-item breakdown.
    """
    if not order_sn or not str(order_sn).strip():
        raise ValueError("order_sn must not be empty")

    payload = client.get(
        "/api/v2/payment/get_escrow_detail",
        {"order_sn": str(order_sn).strip()},
    )
    request_id = payload.get("request_id")
    response = payload.get("response") or {}
    if not isinstance(response, dict):
        response = {}
    return EscrowDetailResponse(
        endpoint="/api/v2/payment/get_escrow_detail",
        request_ids=[str(request_id)] if request_id else [],
        order_sn=str(order_sn).strip(),
        escrow_detail=response,
    )


def get_escrow_detail_batch(
    client: ShopeeClient,
    *,
    order_sn_list: Sequence[str],
) -> EscrowDetailBatchResponse:
    """Fetch full accounting detail for up to 50 orders in one call.

    Recommended batch size is 1-20 to stay under typical rate-limit
    budgets. Prefer this over `get_escrow_detail` whenever you have
    more than one order to look up.
    """
    normalized = [str(sn).strip() for sn in order_sn_list if str(sn).strip()]
    if not normalized:
        raise ValueError("order_sn_list must not be empty")
    if len(normalized) > 50:
        raise ValueError("order_sn_list may contain at most 50 ids per call")

    payload = client.post(
        "/api/v2/payment/get_escrow_detail_batch",
        {"order_sn_list": normalized},
    )
    request_id = payload.get("request_id")
    response = payload.get("response") or {}
    if not isinstance(response, list):
        response = []
    details = [item for item in response if isinstance(item, dict)]
    return EscrowDetailBatchResponse(
        endpoint="/api/v2/payment/get_escrow_detail_batch",
        request_ids=[str(request_id)] if request_id else [],
        total_fetched=len(details),
        order_sn_list=normalized,
        escrow_details=details,
    )


def get_payout_info(
    client: ShopeeClient,
    *,
    payout_time_from: int,
    payout_time_to: int,
    page_size: int = 40,
    cursor: str = "",
    max_pages: int = 10,
) -> PayoutInfoResponse:
    """List bank payout events for a CB seller in a payout-time window.

    CB-only (returns an error for local shops). Cursor-based
    pagination. `payout_time_from/to` accept a max 15-day window.
    Each entry's `encrypted_payout_id` is the join key for
    `get_billing_transaction_info`.
    """
    if payout_time_from <= 0 or payout_time_to <= 0:
        raise ValueError("payout_time_from and payout_time_to must be positive unix timestamps")
    if payout_time_from > payout_time_to:
        raise ValueError("payout_time_from must be <= payout_time_to")
    if page_size <= 0 or page_size > 100:
        raise ValueError("page_size must be in (0, 100]")
    if max_pages <= 0:
        raise ValueError("max_pages must be > 0")

    collected: list[dict[str, Any]] = []
    request_ids: list[str] = []
    next_cursor = cursor
    has_more = False
    last_next_cursor: str | None = next_cursor

    for _ in range(max_pages):
        params: dict[str, Any] = {
            "payout_time_from": payout_time_from,
            "payout_time_to": payout_time_to,
            "page_size": page_size,
            "cursor": next_cursor or "",
        }
        payload = client.get("/api/v2/payment/get_payout_info", params)
        request_id = payload.get("request_id")
        if request_id:
            request_ids.append(str(request_id))

        response = payload.get("response") or {}
        if not isinstance(response, dict):
            response = {}
        records = response.get("payout_list") or []
        if not isinstance(records, list):
            records = []
        collected.extend([item for item in records if isinstance(item, dict)])

        has_more = bool(response.get("more"))
        raw_cursor = response.get("next_cursor")
        last_next_cursor = raw_cursor if isinstance(raw_cursor, str) and raw_cursor else None
        next_cursor = last_next_cursor or ""
        if not has_more:
            break

    return PayoutInfoResponse(
        endpoint="/api/v2/payment/get_payout_info",
        request_ids=request_ids,
        total_fetched=len(collected),
        pages_fetched=len(request_ids),
        has_more=has_more,
        next_cursor=last_next_cursor,
        payout_list=collected,
    )


def get_payout_detail(
    client: ShopeeClient,
    *,
    payout_time_from: int,
    payout_time_to: int,
    page_size: int = 40,
    page_no: int = 1,
    max_pages: int = 10,
) -> PayoutDetailResponse:
    """Legacy page-based payout listing (CB only).

    Unlike `get_payout_info`, this returns an inline
    `escrow_list[]` and `offline_adjustment_list[]` per payout, so
    you can attribute DRC refunds / offline compensations to a
    specific `order_sn` in a single call.
    """
    if payout_time_from <= 0 or payout_time_to <= 0:
        raise ValueError("payout_time_from and payout_time_to must be positive unix timestamps")
    if payout_time_from > payout_time_to:
        raise ValueError("payout_time_from must be <= payout_time_to")
    if page_size <= 0 or page_size > 100:
        raise ValueError("page_size must be in (0, 100]")
    if page_no <= 0:
        raise ValueError("page_no must be > 0")
    if max_pages <= 0:
        raise ValueError("max_pages must be > 0")

    collected: list[dict[str, Any]] = []
    request_ids: list[str] = []
    current_page = page_no
    has_more = False
    next_cursor: str | None = None

    for _ in range(max_pages):
        payload = client.get(
            "/api/v2/payment/get_payout_detail",
            {
                "payout_time_from": payout_time_from,
                "payout_time_to": payout_time_to,
                "page_size": page_size,
                "page_no": current_page,
            },
        )
        request_id = payload.get("request_id")
        if request_id:
            request_ids.append(str(request_id))

        response = payload.get("response") or {}
        if not isinstance(response, dict):
            response = {}
        records = response.get("payout_list") or []
        if not isinstance(records, list):
            records = []
        collected.extend([item for item in records if isinstance(item, dict)])

        has_more = bool(response.get("more"))
        raw_cursor = response.get("next_cursor")
        if isinstance(raw_cursor, str) and raw_cursor:
            next_cursor = raw_cursor
        else:
            next_cursor = None
        if not has_more:
            break
        current_page += 1

    return PayoutDetailResponse(
        endpoint="/api/v2/payment/get_payout_detail",
        request_ids=request_ids,
        total_fetched=len(collected),
        pages_fetched=len(request_ids),
        has_more=has_more,
        next_cursor=next_cursor,
        payout_list=collected,
    )


def get_billing_transaction_info(
    client: ShopeeClient,
    *,
    billing_transaction_info_type: int,
    encrypted_payout_ids: Sequence[str] | None = None,
    cursor: str = "",
    page_size: int = 40,
    max_pages: int = 10,
) -> BillingTransactionInfoResponse:
    """Drill into the line items tied to one or more payout events.

    CB-only. `billing_transaction_info_type` is 1 (TO_RELEASE) or 2
    (RELEASED). Pass `encrypted_payout_ids` from `get_payout_info` to
    scope the response to specific payouts. Returns ESCROW and
    ADJUSTMENT lines with their `order_sn`, `cost_header`, and
    `scenario` so you can reconcile an order's `escrow_amount` to
    the actual money that landed in the payee account.
    """
    if billing_transaction_info_type not in (1, 2):
        raise ValueError("billing_transaction_info_type must be 1 (TO_RELEASE) or 2 (RELEASED)")
    if page_size <= 0 or page_size > 100:
        raise ValueError("page_size must be in (0, 100]")
    if max_pages <= 0:
        raise ValueError("max_pages must be > 0")

    normalized_ids: list[str] | None = None
    if encrypted_payout_ids is not None:
        normalized_ids = [str(pid).strip() for pid in encrypted_payout_ids if str(pid).strip()]
        if len(normalized_ids) > 100:
            raise ValueError("encrypted_payout_ids may contain at most 100 ids per call")

    collected: list[dict[str, Any]] = []
    request_ids: list[str] = []
    next_cursor = cursor
    has_more = False
    last_next_cursor: str | None = next_cursor or None

    for _ in range(max_pages):
        body: dict[str, Any] = {
            "billing_transaction_info_type": billing_transaction_info_type,
            "cursor": next_cursor or "",
            "page_size": page_size,
        }
        if normalized_ids:
            body["encrypted_payout_ids"] = normalized_ids

        payload = client.post("/api/v2/payment/get_billing_transaction_info", body)
        request_id = payload.get("request_id")
        if request_id:
            request_ids.append(str(request_id))

        response = payload.get("response") or {}
        if not isinstance(response, dict):
            response = {}
        records = response.get("transactions") or response.get("transaction_list") or []
        if not isinstance(records, list):
            records = []
        collected.extend([item for item in records if isinstance(item, dict)])

        has_more = bool(response.get("more"))
        raw_cursor = response.get("next_cursor")
        last_next_cursor = raw_cursor if isinstance(raw_cursor, str) and raw_cursor else None
        next_cursor = last_next_cursor or ""
        if not has_more:
            break

    return BillingTransactionInfoResponse(
        endpoint="/api/v2/payment/get_billing_transaction_info",
        request_ids=request_ids,
        total_fetched=len(collected),
        pages_fetched=len(request_ids),
        has_more=has_more,
        next_cursor=last_next_cursor,
        billing_transaction_info_type=billing_transaction_info_type,
        transactions=collected,
    )


# ---------------------------------------------------------------------------
# Per-order + per-item payout breakdown
# ---------------------------------------------------------------------------


def _money(value: Any) -> float:
    """Best-effort numeric coercion; treats None/non-numeric as 0."""
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


def _detect_currency(escrow_detail: dict[str, Any]) -> str | None:
    """Best-effort currency detection from order_income / buyer_payment_info.

    Falls back to None when the shop is silent on currency (regional
    shops typically use the local fiat so the absence is informative).
    """
    for block_name in ("order_income", "buyer_payment_info"):
        block = escrow_detail.get(block_name)
        if isinstance(block, dict):
            for key in ("pri_currency", "aff_currency", "currency"):
                value = block.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip().upper()
    return None


def _item_is_bundle_sub_item(item: dict[str, Any]) -> bool:
    activity = item.get("activity_type")
    if activity in ("bundle_deal", "add_on_deal"):
        return not bool(item.get("is_main_item"))
    return False


def compute_order_payout_breakdown(escrow_detail: dict[str, Any]) -> dict[str, Any]:
    """Build a structured per-order + per-item payout report.

    Walks the `order_income` and `items[]` blocks of a single
    `escrow_detail` payload and returns a dict with the gross
    revenue, every fee/discount/tax bucket, the canonical
    `escrow_amount` payout, and a per-item breakdown of revenue,
    discounts, fees, and seller profit. Region-conditional fee
    fields default to 0 and the function records a human-readable
    note whenever one is absent so reports are self-explanatory.

    `escrow_amount` (the canonical seller net) is the simplest
    "payout" answer. The structured blocks here are for reports
    that need to show *which* fees were charged and *which* items
    contributed to them.

    All `*_fee` sums are produced for non-CB-SIP shops. For
    CB-SIP affiliate shops, prefer the `*_pri` fields and
    `escrow_amount_pri * exchange_rate`; the helper will note
    the difference when both code paths are present.
    """
    notes: list[str] = []
    if not isinstance(escrow_detail, dict):
        notes.append("escrow_detail is not a dict; returning empty breakdown")
        return {
            "order_sn": None,
            "currency": None,
            "items": [],
            "payout": {"escrow_amount": 0.0, "escrow_amount_after_adjustment": 0.0, "seller_return_refund": 0.0},
            "notes": notes,
        }

    order_income = escrow_detail.get("order_income") or {}
    if not isinstance(order_income, dict):
        order_income = {}

    items_raw = order_income.get("items")
    if not isinstance(items_raw, list):
        items_raw = escrow_detail.get("items")
    if not isinstance(items_raw, list):
        items_raw = []

    currency = _detect_currency(escrow_detail)
    if currency is None:
        notes.append("currency not present in escrow_detail; assuming shop-local fiat")

    cb_sip = any(
        isinstance(order_income.get(field), (int, float)) and order_income.get(field) not in (None, 0)
        for field in ("escrow_amount_pri", "exchange_rate", "pri_currency")
    )
    if cb_sip:
        notes.append(
            "CB-SIP affiliate shop detected: prefer escrow_amount_pri * exchange_rate for primary-currency values"
        )

    # ----- Revenue -----
    gross_revenue = _money(order_income.get("order_discounted_price"))
    if gross_revenue == 0 and items_raw:
        # Fallback: sum per-item discounted_price * quantity.
        gross_revenue = sum(
            _money(item.get("discounted_price")) * float(_money(item.get("quantity_purchased")) or 1)
            for item in items_raw
            if isinstance(item, dict)
        )

    # ----- Discounts -----
    total_seller_discount = _money(order_income.get("seller_discount"))
    total_shopee_discount = _money(order_income.get("shopee_discount"))
    total_voucher_seller = _money(order_income.get("voucher_from_seller"))
    total_voucher_shopee = _money(order_income.get("voucher_from_shopee"))
    total_coins = _money(order_income.get("coins"))

    # ----- Shipping -----
    shipping = {
        "buyer_paid": _money(order_income.get("buyer_paid_shipping_fee")),
        "actual": _money(order_income.get("actual_shipping_fee")),
        "rebate": _money(order_income.get("shopee_shipping_rebate")),
        "reverse": _money(order_income.get("reverse_shipping_fee")),
        "sst": _money(order_income.get("shipping_fee_sst")),
        "reverse_sst": _money(order_income.get("reverse_shipping_fee_sst")),
        "return_to_seller": _money(order_income.get("final_return_to_seller_shipping_fee")),
        "discount_from_3pl": _money(order_income.get("shipping_fee_discount_from_3pl")),
        "seller_shipping_discount": _money(order_income.get("seller_shipping_discount")),
        "estimated": _money(order_income.get("estimated_shipping_fee")),
        "final": _money(order_income.get("final_shipping_fee")),
    }

    # ----- Taxes -----
    taxes = {
        "escrow_tax": _money(order_income.get("escrow_tax")),
        "gst_product": _money(order_income.get("final_escrow_product_gst")),
        "gst_shipping": _money(order_income.get("final_escrow_shipping_gst")),
        "vat_product": _money(order_income.get("final_product_vat_tax")),
        "vat_shipping": _money(order_income.get("final_shipping_vat_tax")),
        "sales_tax_lvg": _money(order_income.get("sales_tax_on_lvg")),
        "vat_on_imported_goods": _money(order_income.get("vat_on_imported_goods")),
        "withholding_tax": _money(order_income.get("withholding_tax")),
        "withholding_vat_tax": _money(order_income.get("withholding_vat_tax")),
        "withholding_pit_tax": _money(order_income.get("withholding_pit_tax")),
        "cross_border_tax": _money(order_income.get("cross_border_tax")),
        "th_import_duty": _money(order_income.get("th_import_duty")),
    }
    for label, value in taxes.items():
        if value == 0:
            notes.append(f"{label}: 0 (region-conditional or not applicable)")

    # ----- Fees -----
    fees = {
        "commission": _money(order_income.get("commission_fee")),
        "service": _money(order_income.get("service_fee")),
        "seller_transaction": _money(order_income.get("seller_transaction_fee")),
        "credit_card_transaction": _money(order_income.get("credit_card_transaction_fee")),
        "campaign": _money(order_income.get("campaign_fee")),
        "ams_commission": _money(order_income.get("order_ams_commission_fee")),
        "seller_order_processing": _money(order_income.get("seller_order_processing_fee")),
        "fbs": _money(order_income.get("fbs_fee")),
        "ads_topup_or_tech_support": _money(order_income.get("ads_escrow_top_up_fee_or_technical_support_fee")),
    }
    for label, value in fees.items():
        if value == 0 and label in {"fbs", "campaign", "seller_order_processing", "ads_topup_or_tech_support", "credit_card_transaction"}:
            notes.append(f"{label}: 0 (region-conditional or not applicable)")

    # ----- Credits back to seller (negative fees) -----
    credit_offsets = {
        "rsf_claim": _money(order_income.get("rsf_seller_protection_fee_claim_amount")),
        "fsf_claim": _money(order_income.get("fsf_seller_protection_fee_claim_amount")),
        "seller_lost_compensation": _money(order_income.get("seller_lost_compensation")),
        "drc_adjustable_refund": _money(order_income.get("drc_adjustable_refund")),
    }
    seller_return_refund = _money(order_income.get("seller_return_refund"))

    # ----- Payout -----
    escrow_amount = _money(order_income.get("escrow_amount"))
    if escrow_amount == 0:
        notes.append("escrow_amount is 0; verify the order is COMPLETED")

    # ----- Order-level fee pool to prorate to items -----
    # `credit_card_transaction_fee` is a derived field equal to
    # `buyer_transaction_fee + seller_transaction_fee`; it is NOT a
    # separate deduction. Use `seller_transaction_fee` only.
    order_level_fee_pool = (
        fees["commission"]
        + fees["service"]
        + fees["seller_transaction"]
        + fees["campaign"]
        + fees["seller_order_processing"]
        + fees["fbs"]
        + fees["ads_topup_or_tech_support"]
        + taxes["escrow_tax"]
        + taxes["gst_product"]
        + taxes["gst_shipping"]
        + taxes["sales_tax_lvg"]
        + taxes["vat_on_imported_goods"]
        + taxes["withholding_tax"]
        + taxes["withholding_vat_tax"]
        + taxes["withholding_pit_tax"]
        + shipping["reverse"]
        + shipping["sst"]
        + shipping["reverse_sst"]
        + shipping["return_to_seller"]
        - credit_offsets["rsf_claim"]
        - credit_offsets["fsf_claim"]
        - credit_offsets["seller_lost_compensation"]
    )

    # ----- Per-item lines -----
    line_revenues: list[float] = []
    for item in items_raw:
        if not isinstance(item, dict):
            continue
        qty = float(_money(item.get("quantity_purchased")) or 1)
        line_revenues.append(_money(item.get("discounted_price")) * qty)

    total_line_revenue = sum(line_revenues)
    if total_line_revenue <= 0:
        notes.append("sum of per-item discounted_price is 0; per-item fee proration will fall back to equal split")

    per_item: list[dict[str, Any]] = []
    for idx, item in enumerate(items_raw):
        if not isinstance(item, dict):
            continue
        qty = float(_money(item.get("quantity_purchased")) or 1)
        line_revenue = line_revenues[idx] if idx < len(line_revenues) else 0.0
        is_bundle_sub = _item_is_bundle_sub_item(item)

        if total_line_revenue > 0:
            weight = line_revenue / total_line_revenue
        elif items_raw:
            weight = 1.0 / max(1, len(items_raw))
            if idx == 0:
                notes.append("per-item fee proration fell back to equal split (zero item revenue)")
        else:
            weight = 0.0

        # For bundle / add-on sub-items, discount_from_coin and
        # discount_from_voucher_shopee are unreliable per the API doc;
        # report them as 0 here and rely on the order-level totals.
        coin = _money(item.get("discount_from_coin")) if not is_bundle_sub else 0.0
        voucher_shopee = _money(item.get("discount_from_voucher_shopee")) if not is_bundle_sub else 0.0
        voucher_seller = _money(item.get("discount_from_voucher_seller"))

        ams_commission_fee = _money(item.get("ams_commission_fee"))
        prorated = round(order_level_fee_pool * weight, 6)
        line_payout = round(
            line_revenue
            - _money(item.get("seller_discount"))
            - coin
            - voucher_seller
            - voucher_shopee
            - ams_commission_fee
            - prorated,
            6,
        )

        per_item.append(
            {
                "item_id": item.get("item_id"),
                "model_id": item.get("model_id"),
                "name": item.get("item_name"),
                "sku": item.get("item_sku"),
                "model_sku": item.get("model_sku"),
                "activity_type": item.get("activity_type") or "",
                "is_main_item": bool(item.get("is_main_item")),
                "is_bundle_sub_item": is_bundle_sub,
                "qty": int(qty) if qty.is_integer() else qty,
                "original_price": _money(item.get("original_price")),
                "selling_price": _money(item.get("selling_price")),
                "discounted_price": _money(item.get("discounted_price")),
                "seller_discount": _money(item.get("seller_discount")),
                "shopee_discount": _money(item.get("shopee_discount")),
                "discount_from_coin": coin,
                "voucher_seller": voucher_seller,
                "voucher_shopee": voucher_shopee,
                "ams_commission_fee": ams_commission_fee,
                "promotion_list": item.get("promotion_list") or [],
                "weight": round(weight, 6),
                "prorated_order_fees": prorated,
                "line_revenue": round(line_revenue, 6),
                "line_payout": line_payout,
            }
        )
        if is_bundle_sub and idx == 0:
            notes.append(
                "bundle / add-on sub-item: per-item discount_from_coin and discount_from_voucher_shopee are unreliable; use order-level totals"
            )

    return {
        "order_sn": escrow_detail.get("order_sn"),
        "currency": currency,
        "is_cb_sip_affiliate": cb_sip,
        "return_order_sn_list": escrow_detail.get("return_order_sn_list") or [],
        "gross_revenue": round(gross_revenue, 6),
        "discounts": {
            "seller": round(total_seller_discount, 6),
            "shopee": round(total_shopee_discount, 6),
            "voucher_seller": round(total_voucher_seller, 6),
            "voucher_shopee": round(total_voucher_shopee, 6),
            "coins": round(total_coins, 6),
        },
        "shipping": {k: round(v, 6) for k, v in shipping.items()},
        "taxes": {k: round(v, 6) for k, v in taxes.items()},
        "fees": {k: round(v, 6) for k, v in fees.items()},
        "credit_offsets": {k: round(v, 6) for k, v in credit_offsets.items()},
        "payout": {
            "escrow_amount": round(escrow_amount, 6),
            "escrow_amount_after_adjustment": round(
                _money(order_income.get("escrow_amount_after_adjustment")), 6
            ),
            "escrow_amount_pri": round(_money(order_income.get("escrow_amount_pri")), 6),
            "exchange_rate": _money(order_income.get("exchange_rate")) or None,
            "seller_return_refund": round(seller_return_refund, 6),
        },
        "items": per_item,
        "notes": notes,
    }
