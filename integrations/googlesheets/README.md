# Google Sheets — product & customer data

The order form reads **live catalog data from Google Sheets** (not a hard-coded
product list). Local JSON under `webform/data/` is only a **demo fallback**.

## Tabs (system of record for the form)

Aligned with `docs/data-schema.md`:

| Tab | Purpose | Used by form | Make |
|-----|---------|--------------|------|
| **Products** | SKU, name, price, unit, category, staff pick, active | Browse, promo, pricing | Optional sync |
| **Clients** | QBO ID, name, phone, email, frequency, active | Personalization, admin, phone lookup | Read + new customers |
| **Previous** | Last non-null order lines per customer | Pre-filled cart | Replace after order |
| **Orders** | One row per submission | — | Append (reminders, audit, invoice ids) |
| **Order Lines** | One row per line item | — | Append |
| **Notes** | Free-text order notes | — | Append if notes present |
| **Delivery Reports** | Driver pull lists | — | Append / rebuild |

## Live DisFruta spreadsheet

Connected workbook (shared **Anyone with the link → Viewer**):

https://docs.google.com/spreadsheets/d/1smT7aeA63aAQwggMQON1sjh1N3G7XBLNdPaKI82EnSA/edit

| Tab | gid | Form role |
|-----|-----|-----------|
| Products | `0` | Catalog (live) |
| Previous | `457485810` | Pre-filled cart lines |
| Clients | `817083110` | Customer personalization / admin |
| Notes | `344020767` | Written by Make.com |
| Delivery Reports | `1710529538` | Written by Make.com |

**Add to the workbook** (import CSV headers from `templates/`):

- `Orders.csv` → tab **Orders**  
- `Order_Lines.csv` → tab **Order Lines**  

Full column definitions: [docs/data-schema.md](../../docs/data-schema.md).

Configured in `webform/js/config.js` → `googleSheets`.

### Actual Products headers (live)

`sku, product_name, description, category, price, active, staff_pick, notes`

- **91** rows with `active=Yes` are shown on the form  
- **76** with `active=No` are hidden  
- Set `staff_pick=Yes` on any row to feature it under Staff Picks  
- Optional later columns: `unit`, `qbo_item_id` (form defaults unit to `ea`, uses SKU as QBO item id until then)

## Products column headers

Use these headers in row 1 (order does not matter; names are flexible):

| Header | Required | Notes |
|--------|----------|--------|
| SKU | Recommended | Unique key; form generates `ROW-n` if blank |
| Product Name | **Yes** | Display name |
| Description | No | Short line under name |
| Category | No | Browse chips; default `General` |
| Price | **Yes** | Unit sell price |
| Unit | No | e.g. `case`, `ea`, `box` — default `ea` |
| Active | No | `Yes` / `No` — blank = active |
| Staff Pick | No | `Yes` shows in promo section |
| QBO Item ID | Recommended | QuickBooks Item Id for invoices |
| Notes | No | Internal |

Example:

```csv
SKU,Product Name,Description,Category,Price,Unit,Active,Staff Pick,QBO Item ID,Notes
AREPA-CHOC-4,Arepa de Choclo-4 Pack,4-pack choclo arepas,Prepared Foods,4.83,ea,Yes,Yes,10,
BB-14,Blackberry-14,14oz bag,Produce & Fruit,3.70,ea,Yes,No,19,
```

## Clients column headers

| Header | Required | Notes |
|--------|----------|--------|
| QuickBooks ID | **Yes** | Used in SMS links `?customerId=` |
| Customer Name | **Yes** | Header personalization |
| Phone Number | Recommended | Twilio |
| Email | No | |
| Frequency | No | Weekly, etc. |
| Day of Week | No | Delivery day |
| Next Delivery Date | No | `YYYY-MM-DD` (Make can also pass via URL) |
| Last Order Date | No | |
| Active | No | Blank = active |
| Notes | No | |

## Previous column headers

| Header | Required | Notes |
|--------|----------|--------|
| QuickBooks ID | **Yes** | Links line to client |
| Customer Name | No | |
| SKU | Recommended | Match Products.SKU |
| Product Name | If no SKU | Fallback match on name |
| Default Quantity | **Yes** | Pre-filled qty |
| unit | No | |
| Frequency / Day of Week | No | |
| Active | No | |
| Last Order Date | No | |
| Notes | No | |

One **row per line item**. Multiple rows share the same QuickBooks ID.

## Connect the form (`webform/js/config.js`)

### Option A — Sheets API (best for production)

1. Google Cloud Console → enable **Google Sheets API** → create an **API key**.
2. Share the spreadsheet: **Anyone with the link → Viewer**.
3. Set:

```js
googleSheets: {
  enabled: true,
  spreadsheetId: "1abc...your_id...",
  apiKey: "AIza...your_key...",
  productsSheet: "Products",
  clientsSheet: "Clients",
  previousSheet: "Previous",
}
```

Restrict the API key to Sheets API + HTTP referrers for your form domain.

### Option B — Publish each tab as CSV

1. File → **Share** → **Publish to web**.
2. Publish **Products**, **Clients**, **Previous** as CSV.
3. Paste URLs:

```js
googleSheets: {
  enabled: true,
  productsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv",
  clientsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=1&single=true&output=csv",
  previousCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=2&single=true&output=csv",
}
```

### Option C — Public sheet + gid

1. Share spreadsheet: **Anyone with the link → Viewer**.
2. Open each tab and copy `#gid=` from the URL.
3. Set `spreadsheetId` + `productsGid` / `clientsGid` / `previousGid`.

> Browser CORS: published CSV (`/pub?output=csv`) and Sheets API work from the
> form origin. Private sheets without API access will fail and fall back to
> local JSON.

## How the form uses the data

```
Google Sheets (Products / Clients / Previous)
        │
        ▼
 webform/js/sheets.js   ← parse + map columns
        │
        ▼
 webform/js/app.js      ← cart UI, search, staff picks
        │
        ▼  Submit
 Make.com webhook → QBO draft invoice + Sheets logs
```

- Only rows with **Active ≠ No** appear.
- **Staff Pick = Yes** → promotional section.
- **Previous** lines seed “Your Previous Order” for that `customerId`.
- Prices on the form come from the **Products** tab at load time.

## Updating products

Owners edit Google Sheets as usual:

1. Add/edit a row on **Products**.
2. Set **Active** / **Staff Pick** / **Price**.
3. Reload the form (no deploy required if using live Sheets URLs).

Keep **QBO Item ID** in sync with QuickBooks so Make can create invoice lines.

## Make.com write helpers

| Scenario / step | Purpose |
|-----------------|---------|
| Form submit → **Orders** | 1 row per submission; reminder guard + invoice ids |
| Form submit → **Order Lines** | Line-level audit / delivery prep |
| Form submit → **Notes** | When notes non-empty |
| Form submit → **Previous** | Replace last order lines after invoice |
| Form submit → **Clients** | Append on new customer |
| QBO Items → Products | Optional nightly product/price sync |
| QBO Customers → Clients | Optional nightly customer sync |

Form **reads** Products / Clients / Previous.  
Make **writes** Orders, Order Lines, Notes, Previous, Delivery Reports, Clients (new).

SMS copy used alongside Sheets: [docs/sms-copy.md](../../docs/sms-copy.md).

## Templates

Import into Google Sheets (File → Import → Upload) or copy headers:

| File | Tab name |
|------|----------|
| `templates/Products.csv` | Products (example rows) |
| `templates/Clients.csv` | Clients |
| `templates/Previous.csv` | Previous |
| `templates/Orders.csv` | **Orders** (order log) |
| `templates/Order_Lines.csv` | **Order Lines** |
| `templates/Notes.csv` | Notes |

See [docs/data-schema.md](../../docs/data-schema.md) for column definitions and `status` enums.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Form shows demo products only | Check browser console; configure `googleSheets` URLs/IDs |
| CORS / blocked fetch | Use Publish-to-web CSV or API key; don’t use private-only sheets |
| Empty previous order | Confirm Previous tab QuickBooks IDs match Clients + SMS `customerId` |
| Wrong prices | Edit Products.Price; hard-refresh the form |
| Invoice item missing in QBO | Fill **QBO Item ID** on Products |
