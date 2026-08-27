# Automation Workflows

**Make.com is the system hub.** All of the following are Make scenarios (or modules inside scenarios). The webform only POSTs the order JSON to a Custom Webhook.

Detail for the order webhook → QBO path: (../make/order-processing.md).

## System Flow Overview

1. **Existing customers** receive personalized form link via Twilio text.  
2. **New customers** receive form link via text, verbally, card, or website.  
3. Customer submits form → data sent to Make.com webhook.  
4. Make.com processes the data and:  
   - Creates invoice in QuickBooks  
   - Saves order to Google Sheets  
   - Sends confirmation text via Twilio  
   - Notifies owners if customer added notes  
   - Notifies owners of any new customer signups  
5. **Daily trigger** in Make.com sends out existing customer links + reminders, and generates the driver pick list from Google Sheets.

## Core workflows

### 1. Order form distribution

- Make checks schedule daily (Clients cadence / next delivery).  
- **Fan out by Contacts**, not a single Clients phone: for each business due, load **Contacts** rows with the same `quickbooks_id` and a non-blank `phone`.  
- Each of those contacts receives their **own** Twilio SMS with a personalized form link.  
- Skip a contact with no phone. Skip the whole business if **Orders** already has a winning row for that `quickbooks_id` + `delivery_date`.  
- Timing based on each customer’s delivery day (designed: **~2 days before** delivery).  
- Link shape (include contact so the form pre-selects the right person):

```
https://YOUR_HOST/webform/index.html?customerId={{qbo_id}}&deliveryDate={{date}}&name={{encode customer_name}}&contact={{encode contact_name}}&contactPhone={{encode phone}}&lang={{lang}}&token={{optional}}
```

Preferred categories come from Clients `preferred_categories` when the form reads the sheet. Optional link override (only if Clients isn’t available):

```
&preferredCategories={{urlencode preferred_categories}}
```

Greeting `{{contact_name}}` when present; otherwise `{{customer_name}}`.

### 2. Reminder system

- Tracks which **businesses** have not submitted for the upcoming delivery (one order per `quickbooks_id` + `delivery_date`).  
- **Skip** if **Orders** log has `status` ∈ (`received`, `invoiced`, `submitted`, `declined`) for that customer + `delivery_date`.  
- If still open, remind **every contact with a phone** (same per-contact link as §1).  
- Sends reminders until **submit**, **decline**, or **5:00 PM** day-before-delivery cutoff.  
- Cadence: Day-2 ×2, Day-1 ×2 including final call (~4pm).  
- **Exact SMS text:** (sms-copy.md) §1–2.

### 3. Order processing (webhook)

Triggered by webform `makeWebhookUrl`:

1. Receive JSON (`version` 1.3, `declined`, `isNewCustomer`, `customer` including `contact` / `frequency` / `frequencyNote`, `order`, `quickbooks`, `notes`).  
2. **Duplicate guard:** search Orders for same `quickbooks_id` + `delivery_date` (status ≠ `error`). If found, return `duplicate_order` and stop.  
3. Generate `order_id`; append **Orders** row (`status=received` or `declined`).  
4. Router:
   - **Declined** → `status=declined`; no invoice; SMS (sms-copy.md) §3 (+ optional owner §7).  
   - **New customer** → Create QBO Customer → Create Invoice → append Clients + **Contacts** (`is_primary=Yes`).  
   - **Returning** → Create Invoice with `customer.qboCustomerId`.  
5. On success: set Orders `status=invoiced`, store `qbo_invoice_id` / `qbo_doc_number`; append **Order Lines**; replace **Previous**; append **Notes** if non-empty.  
6. On QBO failure: Orders `status=error` + `error_message`; SMS owner §9.  
7. Twilio confirmation §4 or §5 to **`customer.contact.phone`** (else Clients phone); owner alert §6.  
8. Delivery Reports: append or rebuild for `delivery_date`.

Schemas: (data-schema.md) · QBO: (../integrations/quickbooks/invoice-mapping.md).

### 4. Text message replies

- Twilio number receives inbound SMS.  
- If body is an exact decline keyword ( (sms-copy.md) § keywords) → same as form decline (Orders + §3).  
- Else forward to owner with template §8.  
- Owner may enter the order via **admin.html** if the customer did not use the form.

### 5. (Optional) Catalog refresh

- Nightly Make scenario: export QBO Items → Products sheet (prices, qbo_item_id).  
- Or rebuild `webform/js/products-data.js` from the sheet for embedded offline catalog.

## Key integrations

| System | Role |
|--------|------|
| Custom web form | Capture order; POST to Make |
| Make.com | Hub: routing, retries, connections |
| Twilio | Outbound reminders/confirmations; inbound forward |
| QuickBooks Online | Invoices (+ customers for new accounts) |
| Google Sheets | Products, Clients, **Contacts**, Previous, **Orders**, **Order Lines**, Notes, Delivery Reports |

## SMS copy

All customer and owner texts: **[sms-copy.md](sms-copy.md)**.

## Configuration checklist

- [ ] Make Custom Webhook URL in `webform/js/config.js` → `makeWebhookUrl`  
- [ ] Make Twilio connection  
- [ ] **Contacts**, **Orders**, and **Order Lines** tabs created (import CSV templates)  
- [ ] Duplicate search on Orders before appending a new row  
- [ ] Distribution iterates Contacts phones (not only Clients)  
- [ ] Products have **qbo_item_id** for every active item  
- [ ] Clients have **quickbooks_id**; Contacts have phones for SMS/lookup  
- [ ] Twilio templates pasted from (sms-copy.md)  
- [ ] `demoMode: false` on the form when going live  