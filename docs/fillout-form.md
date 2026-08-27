# Order Form Design

> **Implemented** in [`webform/`](../webform/) (not Fillout). Brand colors from `Logo/`.  
> Submit target: **Make.com** webhook → QBO / Sheets / Twilio.

## Preview

```bash
cd webform && python3 -m http.server 8080
```

- Returning: `index.html?customerId=24`  
- Returning + contact: `index.html?customerId=24&contact=Ana%20Ruiz&contactPhone=15551234001`  
- New customer: `index.html` or `index.html?new=1`  
- Admin: `admin.html`  

## Form purpose

Clean, personalized, mobile-friendly ordering so customers can review and modify a recurring order—or place a **first** order as a new customer.

## Form layout

### Admin (`admin.html` only)

- Customer select (QuickBooks Online id → name)  
- Selecting a customer fills the header and loads previous order for order-on-behalf  
- Unlock with any **Contacts** phone; contact picker + already-submitted lock same as customer form  

### Landing (no `customerId`)

- **I’m a new customer** → contact form + empty cart  
- **I already order with DisFruta** → phone lookup against **Contacts** (falls back to Clients phone)  

### Header

- Logo + DisFruta branding  
- Customer name (or “New customer”); returning subtitle can show **Ordering as {contact}**  
- Next delivery date (computed from preferred day + frequency when not passed on the URL)  
- Title: “What would you like this week?”  

### New-customer contact form

- Business name + phone (required)  
- Email, preferred delivery day, **order frequency**, language, address  
- Frequency options: Weekly, Every 2 weeks (Bi-Weekly), **Every 3 weeks**, Monthly, Twice weekly, **Other**  
- **Other** reveals a required note: “Describe your frequency”  

### Who is placing this order? (returning + admin)

Shown when **Contacts** has more than one person for that QuickBooks ID.

- Dropdown of `contact_name` · phone (primary labeled)  
- SMS `contact` / `contactPhone` pre-selects the recipient  
- Payload `customer.contact` is the person who submitted  

### Already submitted (returning + admin)

If **Orders** already has a winning row for this `quickbooks_id` + `delivery_date`, the cart is hidden and the form shows **Order already submitted** (or skipped, if declined). First submission wins.

### 1. Your Previous Order / Your Order

- Product name, short description, unit, price  
- Quantity stepper (pre-filled for returning customers)  
- Line subtotal, remove  

### 2. Staff Picks (conditional)

- Shown **only** if one or more active products have `staff_pick` set in Sheets  
- One-click Add  
- Hidden entirely when none  

### 3. Add more items

- Returning customers with **Preferred Categories** on Clients see **only those categories** by default  
- **Add other items** / **Show preferred only** toggles the full catalog  
- Search runs in the current scope (preferred set, or full catalog after the toggle)  
- Category chips (fruit pulps row 1; Frozen Food / Soda / Dry Food row 2)  
- Qty + Add; optional **Add all in category**  

### 4. Special notes

- Free text (delivery instructions, samples, etc.)  

### 5. Decline entire order period (returning + admin)

Shown when a known customer is loaded (not for brand-new self-serve accounts) and no order already exists for this delivery:

- Card near the top: **“Don’t need a delivery this period?”**  
- Sticky bar: **Skip period**  
- Footer link: **No order needed this period**  

Confirm dialog explains: no invoice, reminders stop for this delivery window, next cycle still open.

Payload: `declined: true`, `declineOrderPeriod: true`, empty `order.lines`, `createQuickBooksInvoice: false`.

Also via SMS: exact keyword `NO` / `SKIP` / etc. — see [sms-copy.md](sms-copy.md).

### 6. Order summary

- Live total  
- Large **Submit Order** (or **Submit first order** for new customers)  
- **Skip period** secondary control (returning / admin)  

## Key notes

- Orders should be in by **5:00 PM** the day before delivery  
- Fully mobile optimized  
- Catalog: Google Sheets when available; embedded `products-data.js` fallback  
- Production: set `makeWebhookUrl` in `js/config.js`  

## Payload highlights (for Make)

| Field | Use |
|-------|-----|
| `declined` / `declineOrderPeriod` | Full period skip — no invoice, stop reminders |
| `delivery.orderPeriodKey` | `qboId\|deliveryDate` for Orders log matching |
| `delivery.frequency` / `delivery.intervalDays` | Cadence + days (21 for Every 3 weeks) |
| `isNewCustomer` | Create QBO customer first |
| `customer.qboCustomerId` | Invoice CustomerRef |
| `customer.frequency` / `customer.frequencyNote` | Cadence; note required when `Other` |
| `customer.contact` | Person placing the order (`name`, `phone`, `email`, `isPrimary`) |
| `customer.preferredCategories` | String array of Products category names |
| `order.lines[]` | Qty, price, `qboItemId`, name |
| `createQuickBooksInvoice` | `false` when declined |
| `quickbooks` | Ready-to-map invoice object (ignore if declined) |
| `notes` | Private note / Notes sheet (includes `Frequency (Other): …` when used) |

See [make/order-processing.md](../make/order-processing.md).
