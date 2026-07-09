# Disfruta Order Automation
Automated ordering system for Disfruta using Fillout forms, Google Sheets, Make.com, and QuickBooks Online.

# Overview
This system allows new and recurring customers to receive personalized order forms via text message, review and modify their previous order, and submit new orders that automatically create invoices in QuickBooks Online and produce daily delivery lists.

# Tech Stack
- **Frontend**: Fillout.com (forms)
- **Database**: Google Sheets
- **Automation**: Make.com
- **Accounting**: Quickbooks Online
- **Messaging**: Twillio

# Key Benefits
- **Saves time** - Customers can quickly reorder instead of texting their order
- **Reduces errors** - Orders go directly into the QuickBooks Online system with accurate quantities and pricing
- **Increases order value** - Smart layout encourages customers to add extra items while also helping move specific inventory (promotions, overstock, or soon-to-expire items)
- **Increases order consistency** - Automated reminders encourage customers to place their order and follow up if they haven’t submitted one yet
- **Improves order quality** - Faster order collection and automated invoicing
- **Better customer experience** - Personalized, convenient, and professional ordering process
- **Instant confirmation & visibility** - Customers receive immediate order confirmation via text, while owners get real-time notifications for every new order
- **Easy to maintain** Owners can update products and pricing easily anywhere
- **Accurate daily delivery lists** - Easily viewable delivery lists creatded daily in Google Sheets

# How It Works
Make.com automatically sends each customer a personalized order form several days before their scheduled delivery day, with timing based on each customer’s individual ordering cadence. If a customer hasn’t submitted their order, they receive friendly reminder messages. When the customer clicks the link, they are taken to a personalized Fillout form showing their previous order. They can easily modify quantities, remove items, or add new products. Once submitted, the customer immediately receives an order confirmation text, and the owners are notified of the new order. Make.com then creates an invoice in QuickBooks Online and updates the daily delivery list in Google Sheets.

# Project Goals
The main goal of this project is to create a simple, automated ordering system that allows new and recurring customers to easily place and modify their orders through a personalized form sent via text message. By streamlining the ordering process, we aim to reduce manual effort for the owners, minimize order errors, increase average order value through smart recommendations, and ensure consistent, timely order submission. Ultimately, the system should make ordering and reordering effortless for customers while giving the business better visibility and control through automated delivery lists and QuickBooks integration.

# Data Structure
1. **Products** Contains all product information including SKU, name, description, price, category, staff pick status, and active status.
2. **Clients** Stores customer information including QuickBooks ID, name, phone number, ordering frequency, and preferences.
3. **Recurring Orders** Links each customer to their standard order items and quantities.
4. **Notes** Captures customer notes from orders, including complaints, sample requests, delivery issues, or special instructions.
5. **Delivery Reports** Generates daily delivery lists for the driver showing exactly what needs to be pulled and delivered each day.

# Future Enhancements
- Automated sync of customer data from QuickBooks Online
- Customer portal for viewing order history
- Advanced reporting and analytics dashboard
- Driver routing and mapping optimization
- AI-powered text messaging
- SMS payment collection
