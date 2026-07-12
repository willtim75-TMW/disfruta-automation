# QuickBooks Online integration

DisFruta creates **invoices in QuickBooks Online** when a customer submits the order form.

## Architecture (Make.com is the hub)

```
Browser webform
    │  POST JSON order
    ▼
Make.com  (brains — routing, logs, SMS, QBO)
    │
    ├─► QuickBooks Online module  →  Create Invoice (preferred)
    ├─► Google Sheets / Twilio
    └─► optional HTTP → server/ Order API → QBO REST (custom logic)
```

- **Default:** Make’s **QuickBooks Online** app creates the invoice (OAuth inside Make).
- **Optional helper:** [`server/`](../../server/README.md) if Make calls it over HTTP.

Primary scenario docs: [`make/order-processing.md`](../../make/order-processing.md).

## Why not browser → QBO?

QuickBooks OAuth secrets must **never** live in frontend JavaScript. Either:

1. Make’s QBO connection (recommended), or  
2. A backend Make can call (`server/`)

## Quick start

```bash
cd server
cp .env.example .env   # add Client ID / Secret
npm install
npm start
# Browser: http://localhost:3001/auth/quickbooks
```

Webform (`webform/js/config.js`):

```js
orderApiUrl: "http://localhost:3001/api/orders",
demoMode: false,
```

## Product / item IDs

Each order line needs a real QBO **Item Id** (`order.lines[].qboItemId`).

1. In QBO: Sales → Products and services → open item → note Id (or export).  
2. On Google Sheets **Products** tab, add column `qbo_item_id` (or `QBO Item ID`).  
3. Form maps that into the invoice `ItemRef.value`.

Until then, the API returns a clear error: *missing qboItemId*.

## Customer IDs

Returning customers: SMS link `?customerId=<QBO Customer Id>` → `CustomerRef.value`.

New customers: API finds by display name or **creates** a Customer, then invoices.

## Draft / print workflow

With `QBO_INVOICE_AS_DRAFT=true` (default), invoices are created with `PrintStatus: NeedToPrint` so owners can review in QBO before the driver run (per MVP requirements).

## Related docs

- [invoice-mapping.md](./invoice-mapping.md) — field map  
- [make/order-processing.md](../../make/order-processing.md) — optional Make.com path  
- [server/README.md](../../server/README.md) — full API setup  
