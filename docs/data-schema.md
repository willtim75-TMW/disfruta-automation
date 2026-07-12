# Data Schema

Google Sheets is the operational data store the form reads and Make.com writes.

Form read path: `webform/js/sheets.js` (+ embedded `products-data.js` / `customers-data.js` fallback).  
Setup: [integrations/googlesheets/README.md](../integrations/googlesheets/README.md).  
CSV templates: [integrations/googlesheets/templates/](../integrations/googlesheets/templates/).

## Live spreadsheet

Configured in `webform/js/config.js` → `googleSheets.spreadsheetId`:

`1smT7aeA63aAQwggMQON1sjh1N3G7XBLNdPaKI82EnSA`

| Tab | Form reads? | Make writes? | Purpose |
|-----|-------------|--------------|---------|
| **Products** | Yes | Optional sync | Catalog |
| **Clients** | Yes | Yes (new customers) | Accounts, SMS, admin |
| **Previous** | Yes | Yes (after order) | Pre-filled cart |
| **Notes** | No | Yes | Free-text order notes |
| **Orders** | No | Yes | One row per submission |
| **Order Lines** | No | Yes | One row per line item |
| **Delivery Reports** | No | Yes | Driver pull lists |

Share **Anyone with the link → Viewer** for browser CSV access (or use API key).

Add **Orders** and **Order Lines** tabs to the live workbook by importing the templates (headers row only is fine).

---

## Products tab

| Column | Required | Notes |
|--------|----------|--------|
| sku | Yes | Unique key |
| product_name | Yes | Display name |
| description | No | |
| category | No | Frozen Food, Dry Food, Fruit Pulps… |
| price | Yes | Unit sell price |
| unit | No | Default `ea` |
| active | No | `Yes` / `No` |
| staff_pick | No | `Yes` → Staff Picks section |
| qbo_item_id | **For invoices** | QuickBooks Item Id |
| notes | No | Internal |

**Live headers today:**  
`sku, product_name, description, category, price, active, staff_pick, notes`  
(Add `qbo_item_id` and `unit` for production invoicing.)

Template: not required (sheet already exists). See Products section in googlesheets README.

---

## Clients tab

| Column | Required | Notes |
|--------|----------|--------|
| quickbooks_id | Yes | QBO Customer Id; SMS `customerId=` |
| customer_name | Yes | |
| phone_number | Recommended | SMS + form lookup |
| email | No | |
| delivery_day | No | e.g. Wednesday |
| frequency | No | Weekly, etc. |
| next_delivery_date | No | `YYYY-MM-DD` |
| last_order_date | No | |
| active | No | |
| notes | No | |

Template: [`Clients.csv`](../integrations/googlesheets/templates/Clients.csv)

---

## Previous tab

One row per line item of the last non-null order.

| Column | Required | Notes |
|--------|----------|--------|
| quickbooks_id | Yes | Links to Clients |
| customer_name | No | |
| sku | Recommended | Match Products.sku |
| product_name | If no SKU | Name fallback |
| default_quantity | Yes | Pre-filled qty |
| unit | No | |
| price | No | History only; form uses Products price |
| frequency | No | |
| day_of_week | No | |
| active | No | |
| last_order_date | No | |
| notes | No | |

Template: [`Previous.csv`](../integrations/googlesheets/templates/Previous.csv)

**After each successful order**, Make should replace that customer’s Previous rows with the new `order.lines` (delete old rows for `quickbooks_id`, then add rows).

---

## Orders tab (Make writes — order log)

**One row per form submission** (including declines).  
Used to: stop reminders, audit history, store QBO invoice ids, debug errors.

Template: [`Orders.csv`](../integrations/googlesheets/templates/Orders.csv)

| Column | Type | Notes |
|--------|------|--------|
| timestamp | ISO datetime | Webhook `submittedAt` |
| order_id | string | Make UUID or `ord_{{timestamp}}_{{customer}}` |
| quickbooks_id | string | From payload; blank if brand-new |
| customer_name | string | |
| phone | string | |
| email | string | |
| delivery_date | date | `delivery.nextDeliveryDate` |
| preferred_day | string | |
| subtotal | number | `0` if declined |
| currency | string | `USD` |
| line_count | number | |
| declined | Yes/No | From `declined` |
| is_new_customer | Yes/No | From `isNewCustomer` |
| source | string | `customer-form` / `new-customer-form` / `admin-form` |
| notes | string | Customer notes |
| qbo_invoice_id | string | QBO Invoice Id after create |
| qbo_doc_number | string | Human invoice # |
| qbo_customer_id_resolved | string | Id used on invoice (may be newly created) |
| status | enum | See below |
| error_message | string | Filled on failure |

### Status values

| status | Meaning |
|--------|---------|
| `received` | Webhook accepted; processing started |
| `declined` | Customer skipped this cycle; no invoice |
| `invoiced` | QBO invoice created successfully |
| `submitted` | Logged without invoice (edge case / manual) |
| `error` | QBO or critical step failed |

### Reminder guard query (Make)

Do **not** send more reminders if Orders has a row where:

- `quickbooks_id` = customer, and  
- `delivery_date` = upcoming delivery, and  
- `status` ∈ (`invoiced`, `submitted`, `declined`)

---

## Order Lines tab (Make writes)

**One row per line item** on non-declined orders.  
Supports delivery prep and audit; optional feed into Delivery Reports.

Template: [`Order_Lines.csv`](../integrations/googlesheets/templates/Order_Lines.csv)

| Column | Notes |
|--------|--------|
| timestamp | Same as parent order |
| order_id | Links to Orders.order_id |
| quickbooks_id | |
| customer_name | |
| line_num | 1…n |
| sku | |
| qbo_item_id | For QBO troubleshooting |
| product_name | |
| quantity | |
| unit | |
| unit_price | |
| line_total | |
| category | |

---

## Notes tab (Make writes)

Free-text from the form `notes` field (and optionally complaint tags later).

Template: [`Notes.csv`](../integrations/googlesheets/templates/Notes.csv)

| Column | Notes |
|--------|--------|
| timestamp | |
| quickbooks_id | |
| customer_name | |
| note | Full text |
| source | Form source |
| order_id | Link to Orders |
| order_date | Date part of submit |
| delivery_date | |

Only add a Notes row when `notes` is non-empty.

---

## Delivery Reports tab (Make writes)

Daily driver list. Build from **Order Lines** (and Orders) for a given delivery date.

Suggested columns (expand as needed):

| Column | Notes |
|--------|--------|
| report_date | Run date |
| delivery_date | |
| quickbooks_id | |
| customer_name | |
| sku | |
| product_name | |
| quantity | |
| unit | |
| category | Sort/pull grouping |
| notes | From Orders.notes |
| qbo_doc_number | Optional |

**Schedule:** After each order (append) and/or daily morning scenario that rebuilds the sheet for “today’s” deliveries.

---

## Make write sequence (order webhook)

1. Generate `order_id`.  
2. Append **Orders** row (`status=received` or `declined`).  
3. If not declined:  
   - Create QBO customer if needed → invoice  
   - Update Orders (`qbo_*`, `status=invoiced` or `error`)  
   - Append **Order Lines**  
   - Replace **Previous** for that customer  
   - Append **Notes** if notes present  
4. Twilio confirmations (see [sms-copy.md](sms-copy.md)).  
