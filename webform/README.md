# DisFruta Order Form

Clean, personalized, mobile-friendly recurring order form for DisFruta customers.

Implements the layout in `docs/fillout-form.md`, branded with the disfruta logo
palette (purple, pink, magenta, yellow, green), and built to post orders to
**Make.com** for **QuickBooks Online** draft invoices.

## Quick start (local)

**Important:** open via HTTP, not `file://` (browsers block product loading on file URLs).

```bash
cd webform
python3 -m http.server 8080
```

Open:

- Landing / new customer: http://localhost:8080/  
- New order direct: http://localhost:8080/?new=1  
- Returning demo: http://localhost:8080/?customerId=24  
- Admin: http://localhost:8080/admin.html  

Products load from `data/products.json` first (91 active items), then refresh from Google Sheets when the browser allows it.

## Form sections (spec)

1. **Header** — logo, customer name, next delivery day, “What would you like this week?”
2. **Your Previous Order** — name, description, unit, price, qty stepper, line subtotal, remove
3. **Promotional / Staff Picks** — one-click Add from `staffPick` products
4. **Add More Items** — search + category browse + qty + Add
5. **Order Summary** — live total + large Submit · special notes · 5 PM cutoff notice
6. **Admin page** — QuickBooks customer select to order on behalf of a client

## Entry modes

| Who | How they open the form |
|-----|------------------------|
| **New customer** | `index.html` → “I’m a new customer”, or `?new=1` |
| **Returning (SMS link)** | `?customerId=<QBO_ID>&deliveryDate=…` |
| **Returning (no link)** | Landing → “I already order” → phone lookup on Clients sheet |
| **Admin** | `admin.html` customer dropdown |

New customers fill business name + phone (required), then build a cart from the live catalog (no previous order). Payload includes `isNewCustomer: true` so Make can create the QBO customer.

## Personalization (returning)

Make.com / Twilio SMS links:

```
https://YOUR_HOST/webform/index.html?customerId=24&deliveryDate=2026-07-15&name=Mercado%20Latino%20Fresh&token=...
```

| Param | Purpose |
|-------|---------|
| `customerId` / `qboId` | QuickBooks Online customer ID |
| `deliveryDate` | Next delivery (YYYY-MM-DD), overrides catalog |
| `name` | Optional display name override |
| `new=1` | Skip landing; open new-customer flow |
| `token` | Optional shared secret for Make filters |

## Google Sheets (product catalog)

**Products, Clients, and Previous orders load from Google Sheets** — that is the
live source of truth for what customers can order and their pre-filled cart.

Configure in `js/config.js` → `googleSheets` (spreadsheet ID + API key, or
published CSV URLs). Full setup: [`../integrations/googlesheets/README.md`](../integrations/googlesheets/README.md).

Until Sheets is connected, the form falls back to `data/products.json` and
`data/customers.json` for local demos.

## Connect Make.com + QuickBooks

1. Create a Make scenario with **Custom webhook** (see `../make/order-processing.md`).
2. Set in `js/config.js`:

```js
makeWebhookUrl: "https://hook.us1.make.com/your-hook-id",
webhookSecret: "long-random-secret",
demoMode: false,
```

3. Map webhook JSON → Google Sheets + QBO **Create Invoice (Draft)** using
   `payload.quickbooks` (see `../integrations/quickbooks/invoice-mapping.md`).
4. Keep the **Products** tab (and QBO Item IDs) updated so invoice lines match.

### Demo mode

If `makeWebhookUrl` is empty and `demoMode: true`, Submit logs the full payload
to the browser console and shows the success screen — useful for UI testing
without Make credentials.

## Brand

Palette from the `disfruta` wordmark logo (deep purple + fruit accents):

| Token | Color | Use |
|-------|-------|-----|
| Purple | `#5a3c6e` | Primary CTA, links, wordmark |
| Pink | `#e65a82` | Accents, hero kicker |
| Magenta | `#b4468c` | Secondary accent |
| Yellow | `#fabe50` | Notices, brand bar |
| Green | `#82be46` | Add buttons, success, leaves |
| Charcoal | `#2a2430` | Text |

Logo assets (from `assets/DISFRUTA_LOGO.pdf`):

- `assets/logo.png` — main / landing
- `assets/logo-header.png` — sticky header
- `assets/favicon.png` — favicon

## Files

```
webform/
  index.html          Customer order form
  admin.html          Admin order-on-behalf
  assets/css/styles.css
  assets/logo.png
  assets/logo-header.png
  assets/favicon.png
  assets/DISFRUTA_LOGO.pdf
  js/config.js        Webhook + Google Sheets config
  js/sheets.js        Sheets CSV/API loader + column mapping
  js/app.js           Cart, search, submit
  data/products.json  Demo fallback catalog
  data/customers.json Demo fallback customers
```

## Production checklist

- [ ] Host `webform/` on HTTPS (Netlify, Cloudflare Pages, S3+CloudFront, etc.)
- [ ] Connect Google Sheets in `js/config.js` (Products / Clients / Previous)
- [ ] Align QBO Item ID + QuickBooks customer IDs in those sheets
- [ ] Configure Make webhook + QBO OAuth + Twilio SMS
- [ ] Set `demoMode: false` and a strong `webhookSecret`
- [ ] Optional: simple password or IP allowlist on `admin.html`
