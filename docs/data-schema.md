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
| **Clients** | Yes | Yes (new customers) | Accounts, cadence, admin |
| **Contacts** | Yes | Yes (new customers) | People at a business (phone/SMS) |
| **Previous** | Yes | Yes (after order) | Pre-filled cart |
| **Notes** | No | Yes | Free-text order notes |
| **Orders** | Yes (duplicate check) | Yes | One row per submission |
| **Order Lines** | No | Yes | One row per line item |
| **Delivery Reports** | No | Yes | Driver pull lists |

Share **Anyone with the link → Viewer** for browser CSV access (or use API key).

Add **Contacts**, **Orders**, and **Order Lines** tabs to the live workbook by importing the templates (headers row only is fine).

**Duplicate orders:** the form (and Make) treat the first row for a given `quickbooks_id` + `delivery_date` as the winner. Later submissions for that pair are rejected. Status `error` does not count as a winning submission.

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
| phone_number | Recommended | Fallback if Contacts has no rows; lookup also uses Contacts phones |
| email | No | |
| delivery_day | No | e.g. Wednesday |
| frequency | No | Weekly, Bi-Weekly, Every 3 weeks, Monthly, Twice Weekly, Other |
| next_delivery_date | No | `YYYY-MM-DD` — form computes from day + cadence when blank (see below) |
| last_order_date | No | |
| preferred_language | Recommended | `en` or `es` — form UI language for this customer. Also pass as SMS `?lang=` |
| preferred_categories | No | Multi-select of Products categories. Comma-separated (Sheets “Allow multiple selections”). Empty = show full catalog |
| pin / access_pin | Optional | Customer order PIN. When set, form requires PIN (and phone) before cart unlocks |
| active | No | |
| notes | No | |

Template: [`Clients.csv`](../integrations/googlesheets/templates/Clients.csv)

**Language:** Returning customers see only their preferred language (no toggle). New customers choose once on the form; Make should write that value back to `preferred_language` when creating the Clients row.

**Access:** Admin page uses owner username/password (`webform/js/config.js` → `auth.admin`) plus a Contacts (or Clients) phone confirmation. Customer PIN is optional per account. Browser checks deter casual misuse only — put `admin.html` behind host auth in production.

### Frequency / next delivery

Stored `frequency` values the form understands:

| Value | Interval (days) | Notes |
|-------|-----------------|--------|
| Weekly | 7 | Default if blank |
| Bi-Weekly | 14 | Label: Every 2 weeks |
| Every 3 weeks | 21 | Same weekday, three weeks later |
| Monthly | 28 | Four-week cadence |
| Twice Weekly | 3 | Next weekday still used for first order |
| Other | 7 | Custom; **`frequencyNote` required** on the form |

Recurring next date = last order + interval, aligned to preferred weekday, skipping the 5:00 PM cutoff window. First order (no last order) = next preferred weekday (cutoff skip is +7, not a full 3-week jump).

When frequency is **Other**, payload `customer.frequencyNote` (and `Frequency (Other): …` in `notes`) is the description. Make should keep `frequency=Other` on Clients and copy the note into Clients `notes`.

### Preferred categories

`preferred_categories` must use the **same names** as Products `category` (e.g. `Frozen Food`, `Dry Food`, `Soda/Drinks`, `Frozen Fruit Pulps 14 Oz`).

Google Sheets setup (true multi-select dropdown):

1. Import [`Categories.csv`](../integrations/googlesheets/templates/Categories.csv) as tab **Categories** (or keep the list in sync with unique Products categories).  
2. Clients → column **Preferred Categories**.  
3. Data → Data validation → **Dropdown (from a range)** → `Categories!A2:A` → enable **Allow multiple selections**.

CSV export is comma-separated. The form also accepts semicolons, pipes, or newlines. Unknown names are ignored.

The order form **defaults to those categories only**. **Add other items** reveals the rest of the catalog. Previous-order lines stay in the cart even if they are outside the preferred set.

SMS links do not need to pass categories when the form can read Clients. Optional override: `preferredCategories=` or `categories=` (comma-separated, URL-encoded).

---

## Contacts tab

One row per person at a business. Several contacts may share the same `quickbooks_id`.

Template: [`Contacts.csv`](../integrations/googlesheets/templates/Contacts.csv)

| Column | Required | Notes |
|--------|----------|--------|
| quickbooks_id | Yes | Links to Clients / QBO Customer Id |
| customer_name | Recommended | Business name (display) |
| contact_name | Yes | Person placing or receiving order SMS |
| phone | Recommended | Twilio + form lookup. Blank = no SMS for this person |
| email | No | |
| is_primary | No | `Yes` / `No` — default selected contact. If none set, first row wins |

If this tab is empty, the form infers a single contact from the Clients phone/email.

SMS distribution iterates **Contacts** (not Clients): every row with a phone gets its own form link (`customerId`, `deliveryDate`, `contact`, `contactPhone`).

Order payload includes `customer.contact` `{ name, phone, email, isPrimary }` for the person who submitted.

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
| frequency | No | Echo of Clients cadence when present |
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
| phone | string | Submitting contact phone when known |
| email | string | Submitting contact email when known |
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

### Reminder / duplicate guard query (Make)

Do **not** send more reminders, and **reject** extra form submissions, if Orders has a row where:

- `quickbooks_id` = customer, and  
- `delivery_date` = upcoming delivery, and  
- `status` ∈ (`received`, `invoiced`, `submitted`, `declined`) — not `error`

First submission wins for that business + delivery date, even if a different contact sends a second form.

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

1. Search **Orders** for the same `quickbooks_id` + `delivery_date` (status ≠ `error`). If found → reject (`duplicate_order`); do not write.  
2. Generate `order_id`.  
3. Append **Orders** row (`status=received` or `declined`).  
4. If not declined:  
   - Create QBO customer if needed → invoice  
   - Update Orders (`qbo_*`, `status=invoiced` or `error`)  
   - Append **Order Lines**  
   - Replace **Previous** for that customer  
   - Append **Notes** if notes present  
   - New customer: append **Clients** + **Contacts** (`is_primary=Yes`)  
5. Twilio confirmations to **`customer.contact.phone`** when set (see [sms-copy.md](sms-copy.md)).  
