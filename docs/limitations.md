# Limitations

This document outlines known limitations of the current system.

## Current Limitations

- **Customer-Specific Pricing**: Only existing recurring items will use the customer's grandfathered pricing. Any *new* items added to an order will use standard pricing from the Products tab.
- **Text Message Replies**: Customers who reply directly to text messages (instead of clicking the order form link) will have their replies forwarded to the owner, but the order must be manually entered into the form.
- **No Two-Way Sync**: Changes made in QuickBooks Online (pricing, customer info, etc.) will not automatically update Google Sheets.
- **No Real-time Inventory**: The system does not check or update inventory levels when orders are placed.
- **Manual Customer Setup**: Adding new customers and setting their delivery cadence must be done manually in Google Sheets.

## Future Considerations
Some of these limitations may be addressed in future phases through deeper QuickBooks integration and AI-powered texting.