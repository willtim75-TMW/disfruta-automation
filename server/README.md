# DisFruta Order API → QuickBooks Online

> **Make.com is the brains.** The webform posts to a Make webhook. Use this
> Node service only if Make calls it via an **HTTP module** for custom QBO
> logic—or as a dev/test tool. Prefer Make’s native **QuickBooks Online**
> modules when they cover invoice + customer create.

Optional helper that **creates invoices in QuickBooks Online** using the
official QBO REST API (OAuth 2.0).

```
Webform ──► Make.com (hub)
               │
               ├─► Google Sheets / Twilio
               └─► HTTP POST /api/orders  (this server, optional)
                        ↓
                  QBO POST /invoice
```

## Prerequisites

1. [Intuit Developer](https://developer.intuit.com/) account  
2. QBO app (sandbox for testing, production when ready)  
3. Node.js 18+  
4. Products in QBO with **Item IDs** stored on your Products sheet as `qbo_item_id` (or SKU if they match)

## Setup

```bash
cd server
cp .env.example .env
# Edit .env — fill QBO_CLIENT_ID, QBO_CLIENT_SECRET, ORDER_WEBHOOK_SECRET
npm install
```

### Intuit app settings

| Setting | Value |
|---------|--------|
| Redirect URI | `http://localhost:3001/auth/quickbooks/callback` (add production URL later) |
| Scopes | `com.intuit.quickbooks.accounting` |
| Environment | Sandbox first |

### Connect QuickBooks

```bash
npm start
# In another terminal / browser:
open http://localhost:3001/auth/quickbooks
```

Sign in, select the company, approve access. Tokens are stored in `server/.qbo-tokens.json` (do not commit).

Check:

```bash
curl http://localhost:3001/health
```

## How Make should call this API

In your Make scenario, after the custom webhook:

1. **HTTP → Make a request**
2. Method `POST`, URL `https://YOUR_API_HOST/api/orders`
3. Headers: `Content-Type: application/json`, `X-Disfruta-Secret: …`
4. Body: the original webhook JSON (or mapped equivalent)
5. Store `invoice.id` / `invoice.docNumber` from the response into Sheets

Webform config stays Make-first:

```js
makeWebhookUrl: "https://hook.us1.make.com/xxxxxxxx",
orderApiUrl: "",  // empty — browser does not call this API
demoMode: false,
```

## Create invoice (API)

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Disfruta-Secret: your-secret" \
  -d @../make/sample-webhook-payload.json
```

Success response:

```json
{
  "ok": true,
  "message": "Invoice created in QuickBooks Online",
  "invoice": {
    "id": "147",
    "docNumber": "1038",
    "totalAmt": 118.96,
    "customerId": "24"
  }
}
```

## What the API does

| Case | Behavior |
|------|----------|
| Returning customer (`customer.qboCustomerId` set) | `POST /invoice` with that CustomerRef |
| New customer (`isNewCustomer: true`) | Find/create Customer, then invoice |
| Declined order | No invoice; `{ declined: true }` |
| Line missing `qboItemId` | **400** — fix Products sheet QBO Item IDs |

### Invoice fields mapped

| QBO field | Source |
|-----------|--------|
| `CustomerRef.value` | `customer.qboCustomerId` |
| `TxnDate` | `delivery.nextDeliveryDate` |
| `Line[].SalesItemLineDetail.ItemRef` | `order.lines[].qboItemId` |
| `Qty` / `UnitPrice` / `Amount` | order lines |
| `PrivateNote` | customer notes + source |
| `CustomerMemo` | `QBO_CUSTOMER_MEMO` |
| `PrintStatus` | `NeedToPrint` when `QBO_INVOICE_AS_DRAFT=true` |

## Production checklist

- [ ] Switch `QBO_ENVIRONMENT=production`  
- [ ] Add production Redirect URI on Intuit app  
- [ ] Re-authorize and store tokens securely  
- [ ] Set real `qbo_item_id` on every active product  
- [ ] Restrict `CORS_ORIGINS` to your form domain  
- [ ] Use a strong `ORDER_WEBHOOK_SECRET`  
- [ ] Host API over HTTPS  

## Make.com (optional parallel path)

You can still point the form at a Make.com webhook **or** have Make call this API.  
Primary path for direct QBO API calls is this server. See `../make/order-processing.md`.

## Files

```
server/
  src/index.js           Express app + OAuth routes
  src/routes/orders.js   POST /api/orders
  src/qbo/client.js      OAuth + token refresh + REST
  src/qbo/invoices.js    Invoice body + create
  src/qbo/customers.js   Create / find customer
  src/qbo/auth-cli.js    Print authorize URL
  .env.example
```
