# Order Form Design

> **Implemented** in [`webform/`](../webform/) (not Fillout). Brand colors from `Logo/`.  
> Submit target: **Make.com** webhook → QBO / Sheets / Twilio.

## Preview

```bash
cd webform && python3 -m http.server 8080
```

- Returning: `index.html?customerId=24`  
- New customer: `index.html` or `index.html?new=1`  
- Admin: `admin.html`  

## Form purpose

Clean, personalized, mobile-friendly ordering so customers can review and modify a recurring order—or place a **first** order as a new customer.

## Form layout

### Admin (`admin.html` only)

- Customer select (QuickBooks Online id → name)  
- Selecting a customer fills the header and loads previous order for order-on-behalf  

### Landing (no `customerId`)

- **I’m a new customer** → contact form + empty cart  
- **I already order with DisFruta** → phone lookup against Clients  

### Header

- Logo + DisFruta branding  
- Customer name (or “New customer”)  
- Next delivery day / preferred day  
- Title: “What would you like this week?”  

### 1. Your Previous Order / Your Order

- Product name, short description, unit, price  
- Quantity stepper (pre-filled for returning customers)  
- Line subtotal, remove  

### 2. Staff Picks (conditional)

- Shown **only** if one or more active products have `staff_pick` set in Sheets  
- One-click Add  
- Hidden entirely when none  

### 3. Add more items

- Search across **all** products (category filter paused while typing)  
- Category chips (all categories visible; fruit pulps row 1; Frozen Food / Soda / Dry Food row 2)  
- Full category list when a chip is selected  
- Qty + Add; optional **Add all in category**  

### 4. Special notes

- Free text (delivery instructions, samples, etc.)  

### 5. Decline entire order period (returning + admin)

Shown when a known customer is loaded (not for brand-new self-serve accounts):

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
| `isNewCustomer` | Create QBO customer first |
| `customer.qboCustomerId` | Invoice CustomerRef |
| `order.lines[]` | Qty, price, `qboItemId`, name |
| `createQuickBooksInvoice` | `false` when declined |
| `quickbooks` | Ready-to-map invoice object (ignore if declined) |
| `notes` | Private note / Notes sheet |

See [make/order-processing.md](../make/order-processing.md).
