# Project Overview

## Objective

Build an automated ordering system for DisFruta that lets customers place and modify orders through a personalized mobile form, while **Make.com** automates invoice creation in QuickBooks Online and delivery list management in Google Sheets.

## Architecture

```
                    ┌─────────────┐
   SMS (Twilio) ──► │  Webform    │ ◄── Google Sheets (Products / Clients / Previous)
                    │  webform/   │
                    └──────┬──────┘
                           │ POST order JSON
                           ▼
                    ┌─────────────┐
                    │  Make.com   │  ← system hub / “brains”
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    Google Sheets    QuickBooks Online   Twilio
    orders, notes,   Create Invoice      confirm +
    previous,        (+ Customer if new) owner alert
    delivery reports
```

Optional: Make HTTP module → `server/` Order API for custom QBO REST logic. The browser always posts to **Make** first.

## Core functionality

| Feature | Status |
|---------|--------|
| Custom mobile order form (`webform/`) | Implemented |
| Returning customer link (`?customerId=`) + previous order | Implemented |
| New customer public entry + contact fields | Implemented |
| Admin order-on-behalf (`admin.html`) | Implemented |
| Product catalog from Sheets + embedded fallback | Implemented |
| Category browse + full-catalog search | Implemented |
| Staff Picks (only if `staff_pick` set) | Implemented |
| Submit → Make.com webhook payload | Implemented |
| Make → QBO invoice (scenario docs) | Documented — configure in Make |
| Make → Sheets / Twilio | Documented — configure in Make |
| SMS form distribution + reminders | Documented — configure in Make |
| Twilio inbound reply → owner forward | Documented — configure in Make |
| Optional Node QBO helper (`server/`) | Implemented (Make-callable) |

## Key integrations

- **Make.com** — Orchestration hub  
- **Custom web form** — Customer + admin UI  
- **Google Sheets** — Catalog and operational data  
- **QuickBooks Online** — Invoices (via Make QBO module)  
- **Twilio** — Outbound SMS + inbound forward  

## Current status

- Form UI complete (new / returning / admin)  
- Live Google Sheet connected for products (with embedded cache)  
- Make.com order-processing blueprint written  
- QBO field mapping and optional Order API available  
- Make scenarios still need to be **built and connected** in the Make UI (webhook URL, QBO OAuth, Twilio)  
- Clients / Previous sheet rows need real customer data for production personalization  
- Products need real **QBO Item IDs** for invoice lines  

## Phase 1 scope

- Order form distribution, collection, and processing  
- QBO draft/print-ready invoices  
- Basic notifications and delivery lists  
- Admin entry for text-in orders  

## Related docs

- [form-flow.md](form-flow.md)  
- [fillout-form.md](fillout-form.md)  
- [data-schema.md](data-schema.md) — includes **Orders** / **Order Lines**  
- [sms-copy.md](sms-copy.md) — Twilio message templates  
- [automation-workflows.md](automation-workflows.md)  
- [limitations.md](limitations.md)  
- [../make/order-processing.md](../make/order-processing.md)  
