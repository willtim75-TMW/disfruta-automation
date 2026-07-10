# Fillout Form - Proposed Design

## Form Purpose
Create a clean, personalized, and mobile-friendly order form that makes it easy for customers to review and modify their recurring order.

## Form Layout

### Admin Header (Only Available on seperarte admin page)
- Customer Select (Quickbooks Online id - Name Mapping)
Selecting a customer in Customer Select fills header and allows for ordering on behalf of client 

### Header
- Customer Name (personalized)
- Next Delivery Day
- Title: "What would you like this week?"


### 1. Your Previous Order 
- Product Name
- Short description
- Unit
- Price 
- Quantity selector (pre-filled - determined by Unit)
- Line subtotal
- Remove button

### 2. Promotional Items
- Dynamic section title (Staff Picks / Promotional / Last Chance, etc.)
- Products pulled from the `staff_pick` column
- One-click "Add" buttons

### 3. Add More Items
- Searchable dropdown (customer can type to find items quickly)
- Browse all products organized by category
- Quantity field + Add button

### 4. Order Summary
- Live updating subtotal
- **Total: $XX.XX**
- Large "Submit Order" button

## Key Notes
- Form must be submitted by 5:00 PM the day before delivery
- Fully mobile optimized
- Customer can add special notes or instructions
