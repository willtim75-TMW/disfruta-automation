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
- Returning + contact: http://localhost:8080/?customerId=24&contact=Ana%20Ruiz&contactPhone=15551234001  
- Already-ordered demo (Orders log): http://localhost:8080/?customerId=24&deliveryDate=2026-07-15  
- Admin: http://localhost:8080/admin.html  
- Spanish via SMS-style link: http://localhost:8080/?customerId=24&lang=es  

## Navigation

- **Logo** (customer form) returns to the landing chooser (new vs existing).
- New-customer path also has **← Back to start** and **Already a customer?**
- Returning (phone lookup) has **← Back to start**.

## Access control

Configured in `js/config.js` → `auth` (logic in `js/auth.js`).

| Surface | Protection |
|---------|------------|
| **Admin** (`admin.html`) | Owner **username + password**, then **any Contacts phone** on file to unlock that account |
| **Customer** | Optional **phone re-confirm** (`auth.customer.requirePhoneConfirm`) and/or **PIN** from Clients (`pin` / `access_pin`) when `requirePinIfSet` is true |

Demo admin (change before production):

- Username: `owner`
- Password: `disfruta-admin`

Browser-side gates are **not** full security. For production, also protect `admin.html` with Cloudflare Access, Netlify password, Basic Auth, or similar. Do not commit real passwords.

## Language (EN / ES)

Language is **per customer**, not a public toggle:

| Who | How language is chosen |
|-----|------------------------|
| **Returning (SMS)** | Clients sheet `preferred_language`, or `?lang=es` / `?lang=en` on the link |
| **Returning (phone)** | Clients sheet `preferred_language` |
| **New customer** | One-time **Preferred language** field on the contact form |
| **Admin** | Follows the selected customer’s preferred language |

Header EN|ES toggle is commented out in HTML (kept for future debugging).

Make.com should: store `customer.preferredLanguage` on new Clients rows, and
append `&lang=es` (or `en`) on Twilio SMS links from the sheet.

Product names stay as stored in the catalog; UI chrome is translated.
Payloads include `customer.preferredLanguage` and `meta.lang`.
Strings: `js/i18n.js`.

Products load from `data/products.json` first (91 active items), then refresh from Google Sheets when the browser allows it.

## Form sections (spec)

1. **Header** — logo, customer name, next delivery date, “What would you like this week?” / “Ordering as {contact}”
2. **Who is placing this order?** — contact picker when a business has multiple **Contacts**
3. **Already submitted** — blocks cart/submit if Orders already has this QBO id + delivery date
4. **New-customer details** — name, phone, email, delivery day, **frequency** (incl. Every 3 weeks + Other), language, address
5. **Your Previous Order** — name, description, unit, price, qty stepper, line subtotal, remove
6. **Promotional / Staff Picks** — one-click Add from `staffPick` products
7. **Add More Items** — preferred categories by default; **Add other items** for the full catalog
8. **Order Summary** — live total + large Submit · special notes · 5 PM cutoff notice
9. **Admin page** — QuickBooks customer select to order on behalf of a client

## Entry modes

| Who | How they open the form |
|-----|------------------------|
| **New customer** | `index.html` → “I’m a new customer”, or `?new=1` |
| **Returning (SMS link)** | `?customerId=<QBO_ID>&deliveryDate=…&contact=…&contactPhone=…` |
| **Returning (no link)** | Landing → “I already order” → phone lookup on **Contacts** (or Clients) |
| **Admin** | `admin.html` customer dropdown |

New customers fill business name + phone (required), plus optional delivery day and **order frequency**, then build a cart from the live catalog (no previous order). Payload includes `isNewCustomer: true` so Make can create the QBO customer and a primary **Contacts** row.

## Personalization (returning)

Make.com / Twilio SMS links:

```
https://YOUR_HOST/webform/index.html?customerId=24&deliveryDate=2026-07-15&name=Mercado%20Latino%20Fresh&contact=Ana%20Ruiz&contactPhone=15551234001&lang=es&token=...
```

| Param | Purpose |
|-------|---------|
| `preferredCategories` / `categories` | Optional comma-separated Products categories (overrides Clients) |
| `customerId` / `qboId` | QuickBooks Online customer ID |
| `deliveryDate` | Next delivery (YYYY-MM-DD), overrides computed date |
| `name` | Optional business display name override |
| `contact` / `contactName` | Pre-select this Contacts person |
| `contactPhone` | Pre-select / match by phone |
| `lang` | `en` / `es` (SMS should match Clients `preferred_language`) |
| `new=1` | Skip landing; open new-customer flow |
| `token` | Optional shared secret for Make filters |

## Google Sheets (catalog + accounts)

**Products, Clients, Contacts, Previous, and Orders** load from Google Sheets.

Configure in `js/config.js` → `googleSheets` (spreadsheet ID + API key, or
published CSV URLs). Full setup: [`../integrations/googlesheets/README.md`](../integrations/googlesheets/README.md).

| Tab | Form use |
|-----|----------|
| Products | Catalog, prices, staff picks |
| Clients | Business cadence, language, PIN |
| Contacts | People / SMS / who is ordering |
| Previous | Pre-filled cart |
| Orders | Duplicate-order guard (first submit wins) |

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
  js/config.js        Webhook + Google Sheets + auth config
  js/i18n.js          EN / ES UI strings
  js/auth.js          Admin login + customer unlock helpers
  js/sheets.js        Sheets CSV/API loader + column mapping
  js/app.js           Cart, search, contacts, duplicate check, submit
  data/products.json  Demo fallback catalog
  data/customers.json Demo fallback customers (incl. sample Contacts)
```

## Production checklist

- [ ] Host `webform/` on HTTPS (Netlify, Cloudflare Pages, S3+CloudFront, etc.)
- [ ] Connect Google Sheets in `js/config.js` (Products / Clients / Contacts / Previous / Orders)
- [ ] Align QBO Item ID + QuickBooks customer IDs in those sheets
- [ ] Configure Make webhook + QBO OAuth + Twilio SMS
- [ ] Set `demoMode: false` and a strong `webhookSecret`
- [ ] Optional: simple password or IP allowlist on `admin.html`
