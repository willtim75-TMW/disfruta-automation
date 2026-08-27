# DisFruta Order Automation

Automated ordering system for **DisFruta** using a custom mobile web form, Google Sheets, **Make.com** (orchestration hub), QuickBooks Online, and Twilio.

## Overview

New and returning customers get a personalized order form (SMS link or public entry), review or build their order, and submit. **Make.com** receives the submission and drives:

- Google Sheets updates (orders, notes, previous order, delivery lists)
- **QuickBooks Online invoice** creation
- Customer confirmation + owner notification texts

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Custom web form (`webform/`) — HTML/CSS/JS |
| Data | Google Sheets (Products, Clients, Contacts, Previous, Orders, Notes, Delivery Reports) |
| Automation hub | **Make.com** |
| Accounting | QuickBooks Online |
| Messaging | Twilio |

## How it works

1. **Make.com** (or admin) sends a personalized order link via Twilio before delivery — **one SMS per Contacts phone**.
2. Customer opens the form:
   - **Returning:** `?customerId=<QBO_ID>&contact=…&contactPhone=…` → previous order pre-filled; contact pre-selected  
   - **New:** landing → “I’m a new customer” → business details (including frequency) + empty cart  
   - **Admin:** `admin.html` → order on behalf of a client  
3. If several people are on the account, they pick **who is placing this order**. If an order already exists for this business + delivery date, the form stops — first submission wins.
4. Customer adjusts quantities, browses by category, searches the full catalog, optional staff picks, notes.
5. Submit → **Make.com webhook** → Sheets + **QBO Create Invoice** + Twilio (to the submitting contact).
6. Customer text replies to the Twilio number are forwarded to the owners.

## Project layout

```
webform/                 Customer + admin order form
make/                    Make.com scenario docs + sample payload
server/                  Optional QBO helper API (Make can HTTP-call it)
integrations/
  googlesheets/          Sheet setup + CSV templates
  quickbooks/            Invoice field mapping
docs/                    Architecture, schema, flows, limitations
Logo/                    Brand logo
```

## Quick start

### 1. Preview the form

```bash
cd webform && python3 -m http.server 8080
```

- Landing / new customer: http://localhost:8080/  
- New order direct: http://localhost:8080/?new=1  
- Returning demo: http://localhost:8080/?customerId=24  
- Returning + contact: http://localhost:8080/?customerId=24&contact=Ana%20Ruiz&contactPhone=15551234001  
- Admin: http://localhost:8080/admin.html  

> Prefer HTTP (not `file://`). Products also load from embedded `js/products-data.js`.

### 2. Connect Make.com (required for live orders)

1. Create a **Custom webhook** scenario (see [make/order-processing.md](make/order-processing.md)).
2. In `webform/js/config.js`:

```js
makeWebhookUrl: "https://hook.us1.make.com/xxxxxxxx",
demoMode: false,
webhookSecret: "optional-shared-secret",
```

3. Map webhook JSON → Sheets + **QuickBooks Online · Create Invoice** + Twilio.

### 3. Google Sheets

Live workbook (form can read Products / Clients / Contacts / Previous / Orders when shared):

https://docs.google.com/spreadsheets/d/1smT7aeA63aAQwggMQON1sjh1N3G7XBLNdPaKI82EnSA/edit  

Setup: [integrations/googlesheets/README.md](integrations/googlesheets/README.md)

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/project-overview.md](docs/project-overview.md) | Architecture, status, phase scope |
| [docs/data-schema.md](docs/data-schema.md) | Google Sheets tabs (**Contacts**, **Orders**, Order Lines, frequency cadence) |
| [docs/sms-copy.md](docs/sms-copy.md) | **Twilio SMS templates** (invite, reminders, confirm, owner) |
| [docs/form-flow.md](docs/form-flow.md) | Customer / new / admin journeys |
| [docs/fillout-form.md](docs/fillout-form.md) | Form UX sections (implemented in `webform/`) |
| [docs/automation-workflows.md](docs/automation-workflows.md) | Make.com workflows |
| [docs/limitations.md](docs/limitations.md) | Known constraints |
| [webform/README.md](webform/README.md) | Form features, config, hosting |
| [make/order-processing.md](make/order-processing.md) | **Make hub** — webhook → Sheets / QBO / Twilio |
| [integrations/quickbooks/](integrations/quickbooks/) | QBO invoice mapping |
| [integrations/googlesheets/](integrations/googlesheets/) | Sheet connection + CSV templates |
| [server/README.md](server/README.md) | Optional QBO helper Make can call via HTTP |

## Data structure (Google Sheets)

1. **Products** — SKU, name, description, category, price, unit, active, staff pick, QBO item id  
2. **Clients** — QuickBooks ID, name, phone, email, frequency / delivery day, preferred categories, active  
3. **Contacts** — People at a business (name, phone, email, primary) — SMS + form picker  
4. **Previous** — Last order lines per customer (pre-fill cart)  
5. **Orders** — One row per submission (status, invoice ids, reminder / duplicate guard)  
6. **Order Lines** — One row per line item  
7. **Notes** — Free-text notes from orders  
8. **Delivery Reports** — Daily driver pull lists (written by Make)  

CSV templates: `integrations/googlesheets/templates/` (`Contacts.csv`, `Orders.csv`, `Order_Lines.csv`, …).

## Key benefits

- Faster reorders; less manual texting  
- Accurate quantities/pricing into QBO  
- Staff picks and catalog browse to grow order value  
- Reminders until submit, decline, or cutoff  
- Confirmation SMS + owner alerts  
- Products/pricing editable in Sheets  

## Future enhancements

- Automated QBO → Sheets customer/product sync  
- Customer order-history portal  
- Reporting dashboard  
- Driver routing  
- AI-assisted text ordering  
- SMS payment collection  
