# Make.com — Order Processing (system hub)

**Make.com is the brains of DisFruta automation.** The webform posts every order
here; Make then drives Google Sheets, QuickBooks Online invoices, Twilio SMS,
and any follow-up steps.

```
┌─────────────┐     webhook      ┌──────────┐
│  Webform    │ ───────────────► │ Make.com │
└─────────────┘                  └────┬─────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
       Google Sheets           QuickBooks Online           Twilio
       (orders, notes,         (Create Invoice API         (confirm +
        previous, delivery)     via QBO module)             owner alert)
```

Optional: Make can call the local/hosted **Order API** (`server/`) with an HTTP
module if you prefer custom QBO logic — still **orchestrated by Make**, not the
browser.

---

## Webform config

`webform/js/config.js`:

```js
makeWebhookUrl: "https://hook.us1.make.com/xxxxxxxx",
webhookSecret: "your-long-random-string", // optional filter
demoMode: false,
orderApiUrl: "", // leave empty — Make is the hub
```

---

## Scenario outline (recommended)

| Step | Module | Purpose |
|------|--------|---------|
| 1 | **Webhooks → Custom webhook** | Receive form JSON (`POST`) |
| 2 | **Tools → Set variables** | Normalize customer ID, subtotal, declined, isNewCustomer |
| 3 | **Router** | A: declined · B: new customer · C: returning order |
| 4A | Google Sheets · Add row | Decline log; stop reminders |
| 5A | Twilio · Send SMS | “No delivery this cycle” |
| 4B | Google Sheets · Add row(s) | Orders log + line items |
| 5B | **QuickBooks Online · Create a Customer** | Only if `isNewCustomer` and no QBO id |
| 6B | **QuickBooks Online · Create an Invoice** | Draft / NeedToPrint invoice |
| 7B | Google Sheets · Update | Store `qbo_invoice_id`, update **Previous** tab |
| 8B | Twilio · customer + owner | Confirmation + new-order alert |

### Alternate 5B/6B: HTTP → Order API

If you use the Node QBO helper instead of Make’s native QBO modules:

| Step | Module | Purpose |
|------|--------|---------|
| 5B | **HTTP → Make a request** | `POST {{ORDER_API}}/api/orders` with same JSON body + `X-Disfruta-Secret` |
| 6B | Parse response | Map `invoice.id` / `docNumber` into Sheets |

The browser still only talks to **Make**.

---

## Webhook setup

1. Make.com → new scenario → **Webhooks → Custom webhook**.
2. Copy the hook URL into `makeWebhookUrl`.
3. Optional filter: header `X-Disfruta-Secret` equals your secret.
4. Run once with **Redetermine data structure** using `make/sample-webhook-payload.json`.

```bash
curl -X POST "$MAKE_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Disfruta-Secret: your-long-random-string" \
  -d @make/sample-webhook-payload.json
```

---

## QuickBooks Online (inside Make)

Use Make’s **QuickBooks Online** connection (OAuth).

### Create Invoice mapping

| QBO field | Payload path |
|-----------|----------------|
| Customer | `customer.qboCustomerId` or `quickbooks.CustomerRef.value` |
| Invoice date | `delivery.nextDeliveryDate` or `quickbooks.TxnDate` |
| Memo | `quickbooks.CustomerMemo.value` |
| Private note | `notes` |
| Lines | Iterator over `order.lines` **or** `quickbooks.Line[]` |
| Item | `order.lines[].qboItemId` → ItemRef |
| Qty | `order.lines[].quantity` |
| Rate | `order.lines[].unitPrice` |
| Amount | `order.lines[].lineTotal` |

**Tips**

- Prefer **draft / Need to print** so Hannah & Felipe can review before delivery.
- `qboItemId` must be real QuickBooks Item IDs (Products sheet column).
- On QBO errors: error route → email/SMS owner + write `status=error` on Orders log.

### New customers (`isNewCustomer: true`)

1. **Create a Customer** (DisplayName, phone, email, address from `customer` / `quickbooks.newCustomer`).
2. Use returned Customer Id for **Create an Invoice**.
3. Append row to **Clients** sheet with new QBO id.

### Declined / skip period (`declined: true` or `declineOrderPeriod: true`)

Customer (or admin) indicated **no delivery needed for this order period**.

| Step | Action |
|------|--------|
| 1 | Append **Orders** with `declined=Yes`, `status=declined`, `subtotal=0`, `line_count=0` |
| 2 | Do **not** create a QBO invoice |
| 3 | Do **not** write Order Lines or change Previous |
| 4 | Optional Notes row if they typed a reason |
| 5 | SMS customer [sms-copy.md](../docs/sms-copy.md) §3 |
| 6 | Optional owner alert §7 |
| 7 | Reminder scenario must **skip** this `quickbooks_id` + `delivery_date` |

Match period using `delivery.nextDeliveryDate` and/or `delivery.orderPeriodKey`.

---

## Google Sheets writes

Full column specs + CSV templates: [docs/data-schema.md](../docs/data-schema.md) · [integrations/googlesheets/templates/](../integrations/googlesheets/templates/).

| Tab | Template | When |
|-----|----------|------|
| **Orders** | `Orders.csv` | Every submission (1 row) |
| **Order Lines** | `Order_Lines.csv` | Each line if not declined |
| **Notes** | `Notes.csv` | If `notes` non-empty |
| **Previous** | replace rows | After successful invoice |
| **Clients** | append | New customer path |
| **Delivery Reports** | append/rebuild | After order or daily |

### Orders status

`received` → `invoiced` | `declined` | `error` (see data-schema).

### Reminder guard

Skip SMS if Orders has matching `quickbooks_id` + `delivery_date` with status `invoiced`, `submitted`, or `declined`.

## Twilio SMS copy

Use exact templates in [docs/sms-copy.md](../docs/sms-copy.md):

| Event | Section |
|-------|---------|
| Initial invite | §1 |
| Reminders Day-2 / Day-1 / final call | §2 |
| Customer declined | §3 |
| Order confirmation | §4–5 |
| Owner new order / decline / error | §6–7, §9 |
| Inbound forward | §8 |

Decline keywords: exact match only (`NO`, `NO ORDER`, `SKIP`, …).

## Reminder / form distribution (separate scenario)

Still owned by Make:

1. Daily: Clients due in ~2 days, no order yet.
2. Twilio SMS with personalized link:

```
https://YOUR_HOST/webform/index.html?customerId={{qbo_id}}&deliveryDate={{date}}&name={{encode name}}&token={{hmac}}
```

3. Reminder cadence per `docs/automation-workflows.md`.

---

## Payload versioning

Form sends `version` (currently `"1.2"`). Branch in Make if the schema changes.

Key flags Make should switch on:

| Field | Meaning |
|-------|---------|
| `declined` | No order this cycle |
| `isNewCustomer` | Create Customer before Invoice |
| `createQuickBooksInvoice` | `true` unless declined |
| `source` | `customer-form` / `new-customer-form` / `admin-form` |
| `quickbooks` | Ready-to-map QBO invoice object |

---

## Related

- Sample body: `make/sample-webhook-payload.json`
- QBO field notes: `integrations/quickbooks/`
- Optional QBO helper API (Make → HTTP): `server/README.md`
