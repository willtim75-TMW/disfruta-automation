# Automation Workflows

## Core Workflows

### 1. Order Form Distribution
- Make.com checks schedule daily
- Sends personalized order forms via Twilio
- Timing based on each customer's individual cadence
- Sends two days before scheduled delivery date a

### 2. Reminder System
- Monitors which customers have not submitted orders
- Sends reminder messages if order not received (2 on Day-2, 2 on Day-1)
- Continues until customer declines order, submits, or 5PM delivery day cut-off arrives

### 3. Order Processing
- Receives submission from form 
- Creates invoice in QuickBooks Online
- Updates daily delivery list in Google Sheets
- Sends order confirmation text to customer
- Sends notification to owners

### 4. Text Message Replies
- Listens for any incoming replies to the Twilio number
- Automatically forwards all customer replies to the owner's cell phone
- Ensures owners are immediately notified of any customer communication
- Supports customers who reply to texts instead of clicking the order form

## Key Integrations
- Custom Web Form (Form submission)
- Twilio (SMS notifications and replies)
- QuickBooks Online (Invoice creation)
- Google Sheets (Delivery reports and data storage)