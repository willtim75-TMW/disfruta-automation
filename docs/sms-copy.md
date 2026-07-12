# Twilio SMS copy

Exact message templates for Make.com → Twilio.  
Placeholders use `{{double_braces}}` — map them from Clients sheet, webhook payload, or Make variables.

**Sender:** DisFruta Twilio number  
**Tone:** Short, friendly, wholesale-professional. Spanish optional variants can be added later.

**Form base URL** (set once in Make as a variable):

```
{{form_base_url}} = https://YOUR_HOST/webform/index.html
```

**Order link** (returning customers):

```
{{order_link}} = {{form_base_url}}?customerId={{quickbooks_id}}&deliveryDate={{delivery_date}}&name={{urlencode customer_name}}
```

**New customer / public link** (no id):

```
{{new_order_link}} = {{form_base_url}}?new=1
```

---

## 1. Initial order invite

**When:** ~2 days before delivery (Make distribution scenario)  
**To:** Customer `phone_number`  
**Stop if:** Already ordered or declined for this `delivery_date`

```
DisFruta: Hola {{customer_name}}! Your delivery is {{delivery_day}} ({{delivery_date_short}}). Review or change your order here: {{order_link}}

Reply NO if you don't need a delivery this week. Order by 5pm the day before. ¡Gracias!
```

**Shorter variant (if near 160-char segments matter):**

```
DisFruta: Hi {{customer_name}} — delivery {{delivery_date_short}}. Place/update your order: {{order_link}} Reply NO to skip. Cutoff 5pm day before.
```

---

## 2. Reminders

Reminders fire only if **no** Orders log row for this customer + delivery_date with `status` in (`invoiced`, `submitted`, `declined`).

### 2a. Reminder — Day-2 (morning)

**When:** Calendar day = delivery − 2, morning  
**Count:** 1st of up to 2 on Day-2

```
DisFruta reminder: {{customer_name}}, we still need your order for {{delivery_date_short}}. Order now: {{order_link}} Or reply NO to skip this week.
```

### 2b. Reminder — Day-2 (afternoon)

**When:** Same day, afternoon if still open

```
DisFruta: Friendly nudge — order for {{delivery_date_short}} isn't in yet. {{order_link}} Reply NO if no delivery needed. Cutoff tomorrow 5pm.
```

### 2c. Reminder — Day-1 morning (day before delivery)

```
DisFruta: Tomorrow is delivery day for {{customer_name}}. Please submit by 5pm today: {{order_link}} Reply NO to cancel this week's delivery.
```

### 2d. Reminder — Day-1 afternoon

```
DisFruta: Afternoon reminder — order cutoff is 5pm today for delivery {{delivery_date_short}}. {{order_link}}
```

### 2e. Final call — Day-1 (e.g. 4:00–4:30 pm)

```
DisFruta FINAL CALL: 5pm cutoff soon for {{delivery_date_short}}. Submit here: {{order_link}} or reply NO. After 5pm we may not fulfill changes.
```

---

## 3. Customer declined entire order period (form or SMS “NO”)

**When:** Webform **No order this period** / **Skip period** (`declined: true` + `declineOrderPeriod: true`), or inbound SMS matches decline keywords below.

**Effect:** No QBO invoice; Orders log `status=declined`; **no more reminders** for this `delivery_date`.

```
DisFruta: Got it — no delivery this period for {{customer_name}}. We won't send more reminders for {{delivery_date_short}}. Message us anytime if that changes. ¡Gracias!
```

---

## 4. Order confirmation (customer)

**When:** After successful Make path (invoice created or order logged as submitted)  
**To:** Customer phone from payload / Clients

```
DisFruta: Order received — thanks {{customer_name}}! {{line_count}} item(s), total {{subtotal_formatted}}. Delivery {{delivery_date_short}}.{{invoice_line}} Questions? Just reply to this text.
```

**Optional invoice fragment** (if QBO doc number available):

```
{{invoice_line}} =  Invoice #{{qbo_doc_number}}.
```

If no doc number yet, leave `{{invoice_line}}` empty (and the space before it).

**Example rendered:**

```
DisFruta: Order received — thanks Mercado Latino Fresh! 3 item(s), total $118.96. Delivery Wed 7/15. Invoice #1038. Questions? Just reply to this text.
```

---

## 5. New customer — first order confirmation

**When:** `isNewCustomer: true` and order accepted

```
DisFruta: Welcome {{customer_name}}! We received your first order ({{line_count}} item(s), {{subtotal_formatted}}). Our team will confirm delivery details shortly. Reply here anytime. ¡Bienvenido!
```

---

## 6. Owner — new order alert

**When:** Every non-declined order  
**To:** Owner cell(s) (Make variable `{{owner_phone}}`, support multiple modules if needed)

```
DisFruta NEW ORDER: {{customer_name}} (QBO {{quickbooks_id_or_NEW}}) · {{line_count}} lines · {{subtotal_formatted}} · delivery {{delivery_date_short}} · source {{source}}{{invoice_bit}}
{{notes_bit}}
```

**Fragments:**

```
{{quickbooks_id_or_NEW}} = quickbooks id or "NEW"
{{invoice_bit}} =  · Inv #{{qbo_doc_number}}   (omit if empty)
{{notes_bit}} = Notes: {{notes}}               (omit if empty)
```

**Example:**

```
DisFruta NEW ORDER: Mercado Latino Fresh (QBO 24) · 3 lines · $118.96 · delivery Wed 7/15 · source customer-form · Inv #1038
Notes: Leave at back door
```

---

## 7. Owner — order declined alert (optional)

```
DisFruta: {{customer_name}} declined delivery for {{delivery_date_short}}. No invoice created.
```

---

## 8. Owner — inbound customer reply (forward)

**When:** Any SMS to the Twilio number that is not a handled keyword (or always, including keywords)

```
DisFruta SMS from {{from_phone}} ({{customer_name_or_unknown}}):
{{message_body}}

— Reply to customer from your phone, or enter order in admin: {{form_base_url}}/admin.html
```

---

## 9. Error / failed invoice (owner)

**When:** QBO create fails after form submit

```
DisFruta ERROR: Order from {{customer_name}} failed in QuickBooks. {{error_message}} Subtotal {{subtotal_formatted}}. Check Make history / Orders log status=error.
```

---

## Decline keywords (inbound SMS)

Treat as decline only when the **entire** message (trimmed, case-insensitive) matches one of:

| Keyword |
|---------|
| `NO` |
| `NO ORDER` |
| `NO DELIVERY` |
| `SKIP` |
| `CANCEL` |
| `NONE` |

Do **not** treat free-form messages containing “no” (e.g. “no cilantro”) as decline — use exact match.

---

## Make variable cheat sheet

| Placeholder | Source |
|-------------|--------|
| `customer_name` | Clients or webhook `customer.name` |
| `quickbooks_id` | Clients / `customer.qboCustomerId` |
| `phone_number` / `from_phone` | Clients or Twilio |
| `delivery_date` | `YYYY-MM-DD` |
| `delivery_date_short` | e.g. `Wed 7/15` (format in Make) |
| `delivery_day` | Wednesday, etc. |
| `order_link` | Built URL above |
| `line_count` | `order.lineCount` |
| `subtotal_formatted` | e.g. `$118.96` from `order.subtotal` |
| `qbo_doc_number` | QBO Create Invoice response |
| `source` | `customer-form` / `new-customer-form` / `admin-form` |
| `notes` | webhook `notes` |
| `owner_phone` | Make data store / constant |
| `form_base_url` | Make constant |

---

## Scenario map

| Scenario | Messages used |
|----------|----------------|
| Distribution | §1 Initial invite |
| Reminders | §2a–2e |
| Order webhook success | §4 or §5 + §6 |
| Order declined | §3 + optional §7 |
| Inbound SMS | §8 (and §3 if keyword) |
| QBO error path | §9 |

Full orchestration: [automation-workflows.md](automation-workflows.md) · [make/order-processing.md](../make/order-processing.md)
