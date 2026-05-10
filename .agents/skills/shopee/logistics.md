# Shopee Logistics Summary

keywords: shopee, logistics, shipping, arrange shipment, ship order, tracking, airway bill, shipping document

## Quick Answer (Use This)

```bash
# 1) Check shipping parameters for an order
python3 -m platform_helpers.shopee.cli logistics ship-param --order-sn <ORDER_SN>

# 2) Arrange shipment (example: pickup)
python3 -m platform_helpers.shopee.cli logistics ship \
  --order-sn <ORDER_SN> \
  --pickup '{"address_id":123456,"pickup_time_id":"2024-06-01T10:00:00+08:00"}'
```

Returns: shipping parameters or shipment response status.

<!-- END_QUICK_ANSWER -->

---

# Full Documentation

## Goal
Arrange Shopee shipments, fetch tracking numbers, and generate shipping documents (AWB).

## Common Endpoint Family
- `/api/v2/logistics/get_shipping_parameter`
- `/api/v2/logistics/ship_order`
- `/api/v2/logistics/update_shipping_order`
- `/api/v2/logistics/get_tracking_number`
- `/api/v2/logistics/get_shipping_document_parameter`
- `/api/v2/logistics/create_shipping_document`
- `/api/v2/logistics/get_shipping_document_result`
- `/api/v2/logistics/download_shipping_document`
- `/api/v2/logistics/get_shipping_document_data_info`

## Deterministic Helper Commands (Preferred)

### Arrange Shipment Flow (Recommended)
1) Get shipping parameters (decide pickup/dropoff/non_integrated):
```bash
python3 -m platform_helpers.shopee.cli logistics ship-param --order-sn <ORDER_SN>
```

2) Arrange shipment (choose one method only):

Pickup example:
```bash
python3 -m platform_helpers.shopee.cli logistics ship \
  --order-sn <ORDER_SN> \
  --pickup '{"address_id":123456,"pickup_time_id":"2024-06-01T10:00:00+08:00"}'
```

Dropoff example:
```bash
python3 -m platform_helpers.shopee.cli logistics ship \
  --order-sn <ORDER_SN> \
  --dropoff '{"branch_id":321,"sender_real_name":"Alice","tracking_number":"TRACK123","slug":"SPX"}'
```

Non-integrated example:
```bash
python3 -m platform_helpers.shopee.cli logistics ship \
  --order-sn <ORDER_SN> \
  --non-integrated '{"tracking_number":"TRACK123"}'
```

3) Update pickup time (if required):
```bash
python3 -m platform_helpers.shopee.cli logistics ship-update \
  --order-sn <ORDER_SN> \
  --address-id 123456 \
  --pickup-time-id "2024-06-01T15:00:00+08:00"
```

4) Get tracking number:
```bash
python3 -m platform_helpers.shopee.cli logistics tracking --order-sn <ORDER_SN>
```

### Shipping Documents (AWB)
1) Get shipping document parameter:
```bash
python3 -m platform_helpers.shopee.cli logistics doc-param \
  --order-list '[{"order_sn":"<ORDER_SN>"}]'
```

2) Create shipping document:
```bash
python3 -m platform_helpers.shopee.cli logistics doc-create \
  --order-list '[{"order_sn":"<ORDER_SN>"}]' \
  --shipping-document-type NORMAL_AIR_WAYBILL
```

3) Check document status:
```bash
python3 -m platform_helpers.shopee.cli logistics doc-status \
  --order-list '[{"order_sn":"<ORDER_SN>"}]' \
  --shipping-document-type NORMAL_AIR_WAYBILL
```

4) Download document:
```bash
python3 -m platform_helpers.shopee.cli logistics doc-download \
  --order-list '[{"order_sn":"<ORDER_SN>"}]' \
  --shipping-document-type NORMAL_AIR_WAYBILL \
  --output out/shopee_awb.pdf
```

### Shipping Document Data Info (Self-designed AWB)
```bash
python3 -m platform_helpers.shopee.cli logistics doc-data \
  --order-sn <ORDER_SN> \
  --recipient-address-info '[{"name":"Buyer","address":"Street 1"}]'
```

## Pagination
- Shipping document APIs are batch-based and not paginated.

## Endpoint Mapping
- `logistics ship-param` -> `/api/v2/logistics/get_shipping_parameter`
- `logistics ship` -> `/api/v2/logistics/ship_order`
- `logistics ship-update` -> `/api/v2/logistics/update_shipping_order`
- `logistics tracking` -> `/api/v2/logistics/get_tracking_number`
- `logistics doc-param` -> `/api/v2/logistics/get_shipping_document_parameter`
- `logistics doc-create` -> `/api/v2/logistics/create_shipping_document`
- `logistics doc-status` -> `/api/v2/logistics/get_shipping_document_result`
- `logistics doc-download` -> `/api/v2/logistics/download_shipping_document`
- `logistics doc-data` -> `/api/v2/logistics/get_shipping_document_data_info`

## Execution Notes
- Execute helper command via `python3 -m platform_helpers.shopee.safe_run -- ...` and summarize JSON fields directly.
- For unsplit orders, `ship` should omit `package_number` (passing it returns `logistics.ship_order_not_need_pacakge_number`).
- `ship` requires exactly one method (`pickup`, `dropoff`, or `non_integrated`). Passing multiple methods returns `logistics.ship_order_only_support_one_type`.

## Guardrails
- For `ship`, include only one of `pickup`, `dropoff`, or `non_integrated`.
- `ship` requires the selected method fields even if empty; helper sends empty objects for unused methods.
- `ship-update` requires both `address_id` and `pickup_time_id`.
- Shipping documents require sequential calls: param -> create -> status -> download.