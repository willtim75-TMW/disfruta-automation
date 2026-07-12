# Automation Workflows

**Make.com is the system hub.** All of the following are Make scenarios (or modules inside scenarios). The webform only POSTs the order JSON to a Custom Webhook.

Detail for the order webhook → QBO path: [make/order-processing.md](../make/order-processing.md).

## Core workflows

### 1. Order form distribution

- Make checks schedule daily (Clients cadence / next delivery).  
- Sends personalized form link via **Twilio**.  
- Timing based on each customer’s delivery day (designed: **~2 days before** delivery).  
- Link shape:

```
https://YOUR_HOST/webform/index.html?customerId={{qbo_id}}&deliveryDate={{date}}&name={{encode name}}&token={{optional}}
```

### 2. Reminder system

- Tracks which customers have not submitted for the upcoming delivery.  
- **Skip** if **Orders** log has `status` ∈ (`invoiced`, `submitted`, `declined`) for that customer + `delivery_date`.  
- Sends reminders until **submit**, **decline**, or **5:00 PM** day-before-delivery cutoff.  
- Cadence: Day-2 ×2, Day-1 ×2 including final call (~4pm).  
- **Exact SMS text:** [sms-copy.md](sms-copy.md) §1–2.

### 3. Order processing (webhook)

Triggered by webform `makeWebhookUrl`:

1. Receive JSON (`version`, `declined`, `isNewCustomer`, `customer`, `order`, `quickbooks`, `notes`).  
2. Generate `order_id`; append **Orders** row (`status=received` or `declined`).  
3. Router:
   - **Declined** → `status=declined`; no invoice; SMS [sms-copy.md](sms-copy.md) §3 (+ optional owner §7).  
   - **New customer** → Create QBO Customer → Create Invoice → append Clients.  
   - **Returning** → Create Invoice with `customer.qboCustomerId`.  
4. On success: set Orders `status=invoiced`, store `qbo_invoice_id` / `qbo_doc_number`; append **Order Lines**; replace **Previous**; append **Notes** if non-empty.  
5. On QBO failure: Orders `status=error` + `error_message`; SMS owner §9.  
6. Twilio customer confirmation §4 or §5; owner alert §6.  
7. Delivery Reports: append or rebuild for `delivery_date`.

Schemas: [data-schema.md](data-schema.md) · QBO: [integrations/quickbooks/invoice-mapping.md](../integrations/quickbooks/invoice-mapping.md).

### 4. Text message replies

- Twilio number receives inbound SMS.  
- If body is an exact decline keyword ([sms-copy.md](sms-copy.md) § keywords) → same as form decline (Orders + §3).  
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
| Google Sheets | Products, Clients, Previous, **Orders**, **Order Lines**, Notes, Delivery Reports |

## SMS copy

All customer and owner texts: **[sms-copy.md](sms-copy.md)**.

## Configuration checklist

- [ ] Make Custom Webhook URL in `webform/js/config.js` → `makeWebhookUrl`  
- [ ] Make QBO connection (OAuth)  
- [ ] Make Twilio connection  
- [ ] Make Google Sheets connection (same workbook as form)  
- [ ] **Orders** + **Order Lines** tabs created (import CSV templates)  
- [ ] Products have **qbo_item_id** for every active item  
- [ ] Clients have **quickbooks_id** + phone for SMS/lookup  
- [ ] Previous populated for recurring pre-fill  
- [ ] Twilio templates pasted from [sms-copy.md](sms-copy.md)  
- [ ] `demoMode: false` on the form when going live  
