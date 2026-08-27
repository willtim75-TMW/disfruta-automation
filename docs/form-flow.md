# Form Flow

## Overview

Customers receive (or open) a personalized order form before their delivery day.  
**Make.com** sends SMS links and reminders; the form handles order capture; Make processes submissions.

Timing (as designed): outreach starts about **2–3 days** before delivery; **5:00 PM the day before delivery** is the order cutoff. Exact reminder counts are defined in [automation-workflows.md](automation-workflows.md).

## Entry modes

| Mode | How | Behavior |
|------|-----|----------|
| **Returning (SMS link)** | `index.html?customerId=<QBO_ID>&deliveryDate=…&name=…&contact=…&contactPhone=…` | Header personalized; **Previous** tab lines pre-fill cart; contact pre-selected; browse defaults to Clients **preferred_categories** |
| **Returning (phone lookup)** | Landing → “I already order” → phone | Match **Contacts** (or Clients) phone → same as above |
| **New customer** | Landing → “I’m a new customer”, or `?new=1` | Contact fields required; empty cart; full catalog. Link: **Already a customer? Find your account** returns to phone lookup / landing |
| **Admin** | `admin.html` | Select QBO customer; order on their behalf |
| **Decline period** | Returning + admin (customer selected, no existing order) | “No order this period” → `declined: true` / `declineOrderPeriod: true` — no invoice, stop reminders for that delivery window |
| **Already ordered** | Returning + admin | If Orders has a winning row for this QBO id + delivery date, form blocks submit/skip |

## Returning customer journey

1. Receives Twilio SMS with personalized link (Make distribution: one SMS per Contacts phone).  
2. Opens form → previous order loaded from **Previous** sheet (when data exists).  
3. If several Contacts exist for that QuickBooks ID, chooses **who is placing this order**.  
4. If an order (or skip) already exists for this `quickbooks_id` + `delivery_date`, the form blocks further submits — first submission wins.  
5. Can adjust qty, remove lines, add from Staff Picks / search / categories.  
6. Optional notes.  
7. **Submit order** **or** **skip the entire period** (no delivery needed).  
8. Make creates QBO invoice (if not declined), updates **Orders** log, sends confirmation SMS.  
9. If declined: Orders `status=declined`, no invoice, no more reminders for that `delivery_date`.  
10. Owners get new-order (or decline) notification.

## New customer journey

1. Opens public form (or marketing link with `?new=1`).  
2. Enters business name + phone (required); optional email, preferred delivery day, **order frequency**, language, address.  
   - Frequency includes **Every 3 weeks** and **Other** (Other requires a short description).  
   - Next delivery date is computed from day + cadence (21 days for Every 3 weeks).  
3. Builds cart from catalog (no previous order).  
4. Submit → Make path with `isNewCustomer: true` → create QBO Customer then Invoice → log to Clients + **Contacts** (primary) / Sheets → notify.

## Admin journey

1. Open `admin.html`.  
2. Select customer (QBO id → name); unlock with any **Contacts** phone on file.  
3. If multiple contacts, choose who is placing the order.  
4. If an order already exists for this delivery, the form is locked (first submission wins).  
5. Edit cart (previous order pre-filled when available).  
6. Submit → same Make webhook with `source: "admin-form"` and `customer.contact`.

## Form behavior (implemented)

- **Staff Picks** section only visible when at least one active product has `staff_pick` set.  
- **Categories** on two rows: fruit pulps first; Frozen Food / Soda / Dry Food second.  
- **Preferred categories** (Clients `preferred_categories`): browse and staff picks default to that set. **Add other items** shows the full catalog. Cart / previous-order lines are never hidden.  
- **Search** searches the current scope (preferred set unless Browse all). Category chip is ignored while typing.  
- **Category chip** (no search) lists products in that category (within scope); optional “Add all”.  
- Live subtotal; sticky Submit.  
- Cutoff notice (5 PM day before delivery).  
- **Order frequency** on new-customer form; next delivery uses cadence (including 21-day / Every 3 weeks).  
- **Contact picker** when a QuickBooks ID has more than one Contacts row.  
- **Preferred category filter** with **Add other items** to browse the rest.  
- **Duplicate guard:** first Orders row for `quickbooks_id` + `delivery_date` wins (`received` / `submitted` / `invoiced` / `declined`; not `error`).

## Key features

- Personalized via QuickBooks Online customer id  
- Multiple people per business (**Contacts** tab)  
- Pre-loaded last non-null order (Previous sheet)  
- Modify, remove, add products  
- New customer onboarding without a prior link (frequency + optional Other note)  
- Admin ordering for text-in customers  
- Notes field for special instructions  
- First-submission-wins duplicate lock  
- Payload ready for Make → QBO (`quickbooks` object + `order.lines` + `customer.contact`)  

## Reminder cadence (Make)

Designed pattern:

- Initial invite ~**2 days** before delivery  
- Day-2: 2 reminders · Day-1: 2 reminders including final call before **5 PM**  
- Stop when **Orders** log shows `received` / `invoiced` / `declined` / `submitted` for that delivery  
- Remind **each Contacts phone**, not only the Clients phone  

**Exact SMS text:** [sms-copy.md](sms-copy.md).  
Orchestration: [automation-workflows.md](automation-workflows.md).
