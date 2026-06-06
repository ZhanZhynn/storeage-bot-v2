# Shopee Payment / Escrow / Payout Summary

keywords: shopee, payment, escrow, payout, billing, fee, commission, profit, payout breakdown, per-item profit, seller net, escrow amount

## Quick Answer (Use This)

```bash
# Get the canonical seller payout (escrow_amount) for one order
python3 -m platform_helpers.shopee.cli payment escrow-detail --order-sn <ORDER_SN>

# Get full per-order + per-item breakdown of revenue, fees, discounts, payout
python3 -m platform_helpers.shopee.cli payment escrow-detail --order-sn <ORDER_SN> --breakdown

# Batch (1-50 orders) with breakdown
python3 -m platform_helpers.shopee.cli payment escrow-batch --order-sn-list <SN1>,<SN2> --breakdown
```

Returns: full accounting detail per order, plus (with `--breakdown`) a structured report of revenue, fees, taxes, discounts, shipping, payout, and per-item profit.

The canonical **"payout for this order"** answer is `payout.escrow_amount` in the breakdown (or `order_income.escrow_amount` in the raw response). It is the seller's expected net after every fee, discount, voucher, coin, shipping cost, tax, and RR/clawback.

<!-- END_QUICK_ANSWER -->

---

# Full Documentation

## Goal
Compute per-order and per-product payout / profit from Shopee, including every fee involved (commission, service, transaction, ads top-up, withholding tax, GST/VAT, etc.).

## Common Endpoint Family
- `/api/v2/payment/get_escrow_list`
- `/api/v2/payment/get_escrow_detail`
- `/api/v2/payment/get_escrow_detail_batch`
- `/api/v2/payment/get_payout_info` (CB only)
- `/api/v2/payment/get_payout_detail` (CB only)
- `/api/v2/payment/get_billing_transaction_info` (CB only)

## Deterministic Helper Commands (Preferred)
- Per-order payout + breakdown:
  - `python3 -m platform_helpers.shopee.cli payment escrow-detail --order-sn <ORDER_SN>`
  - `python3 -m platform_helpers.shopee.cli payment escrow-detail --order-sn <ORDER_SN> --breakdown`
- Batch (1-50 orders per call, recommend ≤20):
  - `python3 -m platform_helpers.shopee.cli payment escrow-batch --order-sn-list <SN1>,<SN2>`
  - `python3 -m platform_helpers.shopee.cli payment escrow-batch --order-sn-list <SN1>,<SN2> --breakdown`
- List released escrows in a window (filters by **escrow release time**, not order create time):
  - `python3 -m platform_helpers.shopee.cli payment escrow-list --release-time-from <ts> --release-time-to <ts>`
  - `python3 -m platform_helpers.shopee.cli payment escrow-list --release-time-from <ts> --release-time-to <ts> --page-size 100 --max-pages 5`
- CB-only payout events (max 15-day window):
  - `python3 -m platform_helpers.shopee.cli payment payout-info --payout-time-from <ts> --payout-time-to <ts> [--cursor …]`
  - `python3 -m platform_helpers.shopee.cli payment payout-detail --payout-time-from <ts> --payout-time-to <ts>`
- CB-only line-item drill-down:
  - `python3 -m platform_helpers.shopee.cli payment billing-info --type 2 [--encrypted-payout-ids <id1>,<id2>]`
  - `--type 1` = TO_RELEASE, `--type 2` = RELEASED

## Pagination
- `escrow-list` / `payout-detail`: page-based (`--page-no`, `--page-size`, `--max-pages`).
- `payout-info` / `billing-info`: cursor-based (`--cursor`, `--page-size`, `--max-pages`).
- `escrow-batch` / `escrow-detail`: single call (1-50 ids per batch).
- `payout_*` / `billing-info`: hard 15-day max window.
- `escrow-list`: no documented max window but filters by release time, not create time.

## Endpoint Mapping
- `escrow-detail`  -> `/api/v2/payment/get_escrow_detail`
- `escrow-batch`   -> `/api/v2/payment/get_escrow_detail_batch`
- `escrow-list`    -> `/api/v2/payment/get_escrow_list`
- `payout-info`    -> `/api/v2/payment/get_payout_info`
- `payout-detail`  -> `/api/v2/payment/get_payout_detail`
- `billing-info`   -> `/api/v2/payment/get_billing_transaction_info`

## How the Breakdown Works

`compute_order_payout_breakdown(escrow_detail)` walks one `escrow_detail` payload and returns a structured dict:

```jsonc
{
  "order_sn": "260606CSV42A6E",
  "currency": "MYR",                  // best-effort; may be null
  "is_cb_sip_affiliate": false,       // when true, prefer *_pri fields + exchange_rate
  "return_order_sn_list": [],
  "gross_revenue": 246.0,             // = sum(item.discounted_price * qty)
  "discounts": {
    "seller": 0.0, "shopee": 0.0,
    "voucher_seller": 0.0, "voucher_shopee": 0.0, "coins": 0.0
  },
  "shipping": {
    "buyer_paid": 4.9, "actual": 0.0, "rebate": 0.0,
    "reverse": 0.0, "sst": 0.0, "reverse_sst": 0.0, "return_to_seller": 0.0,
    "discount_from_3pl": 0.0, "seller_shipping_discount": 0.0,
    "estimated": 4.9, "final": 0.0
  },
  "taxes": { /* escrow_tax, gst_product, gst_shipping, vat_product, vat_shipping,
                sales_tax_lvg, vat_on_imported_goods, withholding_tax,
                withholding_vat_tax, withholding_pit_tax, cross_border_tax, th_import_duty */ },
  "fees": {
    "commission": 0.0, "service": 0.0, "seller_transaction": 5.02,
    "credit_card_transaction": 5.02,  // informational: = buyer + seller txn fee
    "campaign": 0.0, "ams_commission": 0.0,
    "seller_order_processing": 0.0, "fbs": 0.0,
    "ads_topup_or_tech_support": 0.0
  },
  "credit_offsets": {
    "rsf_claim": 0.0, "fsf_claim": 0.0,
    "seller_lost_compensation": 0.0, "drc_adjustable_refund": 0.0
  },
  "payout": {
    "escrow_amount": 245.88,              // canonical seller net
    "escrow_amount_after_adjustment": 245.88,
    "escrow_amount_pri": 0.0, "exchange_rate": null,
    "seller_return_refund": 0.0
  },
  "items": [
    {
      "item_id": 844134050, "model_id": 11237991, "name": "StoreAge logo",
      "sku": "", "model_sku": "qwer",
      "activity_type": "", "is_main_item": false, "is_bundle_sub_item": false,
      "qty": 1, "original_price": 123.0, "selling_price": 123.0, "discounted_price": 123.0,
      "seller_discount": 0.0, "shopee_discount": 0.0,
      "discount_from_coin": 0.0, "voucher_seller": 0.0, "voucher_shopee": 0.0,
      "ams_commission_fee": 0.0, "promotion_list": [],
      "weight": 0.5,                       // share of order discounted_price
      "prorated_order_fees": 2.51,         // weight * (sum of order-level fees)
      "line_revenue": 123.0,               // discounted_price * qty
      "line_payout": 120.49                // line_revenue - per-item deductions - prorated
    }
  ],
  "notes": [ /* human-readable notes about zero/region-conditional fields */ ]
}
```

### Per-item revenue + fees — the only honest answer
- **Per-item revenue:** `item.discounted_price * item.quantity_purchased`.
- **Per-item fee the API attributes:** only `ams_commission_fee` (affiliate) is per-item in the raw response.
- **All other fees are order-level** and are **prorated to items by `discounted_price` weight** inside the helper. The shop does not split commission/service/tax to items, so this is the only honest allocation.
- Per-item line payout = `line_revenue − seller_discount − discount_from_coin − voucher_seller − voucher_shopee − ams_commission_fee − prorated_order_fees`.
- `line_payout` does NOT include shipping flows; the full order escrow is `sum(line_payout) + shipping.buyer_paid − shipping.actual + shipping.rebate` (or just read `payout.escrow_amount`).

### Profit recipe
```
payout.escrow_amount                         # canonical seller net (canonical answer)
+ payout.seller_return_refund                # adds back to seller
+ credit_offsets.drc_adjustable_refund       # adds back to seller
- your COGS                                  # from your own books
= seller profit for this order
```
For per-item profit, allocate `original_cost_of_goods_sold` (or your own cost) by the same `weight` used for fee proration.

## Region-Conditional Fields
Many fields are only populated for specific shop types / regions. The helper defaults them to 0 and records a `note` so reports are self-explanatory. Common cases:

- `final_escrow_product_gst` / `final_escrow_shipping_gst` → SG only
- `withholding_tax` → PH, ID local only
- `withholding_vat_tax` / `withholding_pit_tax` → VN only
- `vat_on_imported_goods` → TH, VN
- `fbs_fee` → PH local only
- `campaign_fee` → some ID local shops
- `seller_order_processing_fee` → region-dependent
- `credit_card_transaction_fee` → only meaningful when `buyer_payment_info.is_paid_by_credit_card` (or in MY where DuitNow QR is sometimes categorized as credit_card_txn by the API)
- `ams_commission_fee` / `order_ams_commission_fee` → only sellers in the Affiliate program
- `net_commission_fee` / `net_service_fee` / `seller_product_rebate` / `kit_items` / `pix_discount` → BR local only
- CB-SIP affiliate shops: parallel `*_pri` fields, `escrow_amount = escrow_amount_pri * exchange_rate` — the helper sets `is_cb_sip_affiliate: true` and you should use the `_pri` fields for primary-currency reporting.

## Gotchas
- `escrow_amount` is a derived value and "will change before order is completed" — pull fresh per report.
- `credit_card_transaction_fee` = `buyer_transaction_fee + seller_transaction_fee` (per API doc) — it is **not a separate deduction**. The helper exposes it under `fees.credit_card_transaction` for visibility but does not include it in the prorated fee pool to avoid double-counting.
- `items[]` in the response is nested under `order_income.items`, not at the top level. The helper handles this.
- `get_escrow_detail_batch` wraps each result in `{"escrow_detail": {...}}` — the CLI handler unwraps automatically.
- For bundle / add-on sub-items, per-item `discount_from_coin` and `discount_from_voucher_shopee` are unreliable per the API doc; use the order-level totals instead. The helper sets those to 0 for sub-items and records a note.
- `get_payout_info`, `get_payout_detail`, and `get_billing_transaction_info` are **CB-only**. Local sellers get `error_param`.
- `payout_amount` field name collision: `escrow_list[].payout_amount` (per-order expected release) ≠ `payout_list[].payout_amount` (per-payout wired amount). Don't mix the two.
- Per-payout `from_amount` can be negative (clawbacks / deductions). Don't assert `> 0` when summing.
- Page-size cap is 100 everywhere.

## Inputs to Clarify
- Order SN(s) to inspect (single or up to 50 batch).
- Time window for `escrow-list` / `payout-info` / `payout-detail` / `billing-info`.
- Whether the shop is CB or local (CB-only endpoints will fail on local shops).
- For `billing-info`: the `encrypted_payout_id`(s) from `payout-info` to scope the response.

## Guardrails
- Stay within the 15-day max window for `payout_*` / `billing-info` / `wallet_transaction_list` and the 14-day max for `income_detail` Released view.
- Batch `escrow-batch` is 1-50 ids; recommend ≤20 to stay under rate limits.
- `credit_card_transaction_fee` is informational; don't add it to fee sums.
- For bundle / add-on orders, prefer order-level discount totals over per-item `discount_from_coin` / `voucher_shopee`.
- For CB-SIP affiliate shops, use `*_pri` fields + `exchange_rate` for primary-currency reporting.
