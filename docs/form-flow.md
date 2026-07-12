# Form Flow

## Overview

Customers receive (or open) a personalized order form before their delivery day.  
**Make.com** sends SMS links and reminders; the form handles order capture; Make processes submissions.

Timing (as designed): outreach starts about **2–3 days** before delivery; **5:00 PM the day before delivery** is the order cutoff. Exact reminder counts are defined in [automation-workflows.md](automation-workflows.md).

## Entry modes

| Mode | How | Behavior |
|------|-----|----------|
| **Returning (SMS link)** | `index.html?customerId=<QBO_ID>&deliveryDate=…&name=…` | Header personalized; **Previous** tab lines pre-fill cart |
| **Returning (phone lookup)** | Landing → “I already order” → phone | Match Clients `phone_number` → same as above |
| **New customer** | Landing → “I’m a new customer”, or `?new=1` | Contact fields required; empty cart; full catalog. Link: **Already a customer? Find your account** returns to phone lookup / landing |
| **Admin** | `admin.html` | Select QBO customer; order on their behalf |
| **Decline period** | Returning + admin (customer selected) | “No order this period” → `declined: true` / `declineOrderPeriod: true` — no invoice, stop reminders for that delivery window |

## Returning customer journey

1. Receives Twilio SMS with personalized link (Make distribution scenario).  
2. Opens form → previous order loaded from **Previous** sheet (when data exists).  
3. Can adjust qty, remove lines, add from Staff Picks / search / categories.  
4. Optional notes.  
5. **Submit order** **or** **skip the entire period** (no delivery needed).  
6. Make creates QBO invoice (if not declined), updates **Orders** log, sends confirmation SMS.  
7. If declined: Orders `status=declined`, no invoice, no more reminders for that `delivery_date`.  
8. Owners get new-order (or decline) notification.

## New customer journey

1. Opens public form (or marketing link with `?new=1`).  
2. Enters business name + phone (required); optional email, delivery day, address.  
3. Builds cart from catalog (no previous order).  
4. Submit → Make path with `isNewCustomer: true` → create QBO Customer then Invoice → log to Clients/Sheets → notify.

## Admin journey

1. Open `admin.html`.  
2. Select customer (QBO id → name).  
3. Edit cart (previous order pre-filled when available).  
4. Submit → same Make webhook with `source: "admin-form"`.

## Form behavior (implemented)

- **Staff Picks** section only visible when at least one active product has `staff_pick` set.  
- **Categories** on two rows: fruit pulps first; Frozen Food / Soda / Dry Food second.  
- **Search** always searches the **full catalog** (not limited to selected category).  
- **Category chip** (no search) lists all products in that category; optional “Add all”.  
- Live subtotal; sticky Submit.  
- Cutoff notice (5 PM day before delivery).

## Key features

- Personalized via QuickBooks Online customer id  
- Pre-loaded last non-null order (Previous sheet)  
- Modify, remove, add products  
- New customer onboarding without a prior link  
- Admin ordering for text-in customers  
- Notes field for special instructions  
- Payload ready for Make → QBO (`quickbooks` object + `order.lines`)  

## Reminder cadence (Make)

Designed pattern:

- Initial invite ~**2 days** before delivery  
- Day-2: 2 reminders · Day-1: 2 reminders including final call before **5 PM**  
- Stop when **Orders** log shows `invoiced` / `declined` / `submitted` for that delivery  

**Exact SMS text:** [sms-copy.md](sms-copy.md).  
Orchestration: [automation-workflows.md](automation-workflows.md).
