# Limitations

Known constraints of the current system and implementation.

## Operational / product

- **Text message replies**: Replies to Twilio are forwarded to the owner; orders must still be entered via **admin form** (or manually in QBO). No AI parse-to-invoice yet.  
- **No two-way sync**: QBO changes (price, customer, items) do not auto-update Sheets unless a Make sync scenario is built.  
- **No real-time inventory**: Orders do not check QBO quantity on hand.  
- **Manual customer setup**: New recurring customers need Clients + cadence (unless they use new-customer form and Make creates QBO + Clients row).  
- **Manual product maintenance**: Products/prices edited in Sheets (or via a future QBO→Sheets sync).  
- **Grandfathered / customer-specific pricing**: Called out as a business requirement; **not yet applied in the form** (all customers see Products sheet list price).  

## Form / technical

- **Browser CORS vs Google Sheets**: Live sheet CSV can fail in some browsers; form falls back to embedded `products-data.js` / `customers-data.js`. After sheet edits, re-export or rebuild embedded data for offline/CORS resilience.  
- **QBO Item IDs**: Invoice lines fail in Make/QBO until each product has a real `qbo_item_id`. SKU alone is not enough unless it equals the QBO Item Id.  
- **Clients / Previous empty in sheet**: Personalization and previous-order pre-fill need rows; demos use embedded sample customers.  
- **Staff Picks**: Section hidden until products have `staff_pick = Yes`.  
- **Make scenarios not in-repo**: Docs describe scenarios; actual Make blueprints must be configured in the Make UI and kept in sync with payload `version`.  
- **Secrets**: Never put QBO client secrets in the webform; only in Make (or `server/.env` if using the helper API).  

## Timing docs inconsistency (historical)

Older notes mixed “2 days” vs “3 days” before delivery and different reminder counts. Treat **Make scenario configuration** as source of truth; align SMS copy with owners. Cutoff remains **5:00 PM day before delivery**.

## Future considerations

- Deeper QBO ↔ Sheets sync  
- AI parsing of inbound SMS orders  
- Payment collection  
- Inventory-aware ordering  
- Customer-specific price rules in the form  
