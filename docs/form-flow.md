# Form Flow

## Overview
The system sends customers a personalized order form via text message three days in advance of their scheduled delivery day.

## Customer Journey
1. Customer receives text message with personalized link
2. Customer presented option to order (order form) or No Order Necessary (Omits order and no additional notifications)
3. Form displays their last previous non-NULL order
4. Customer can modify quantities, remove items, or add new items
5. Customer submits order
6. Customer receives order confirmation text
7. Owners receive notification of new order

## Key Features
- Personalized per customer untilizing Quickbooks Online ID and Pricing Rules
- Pre-loaded with with most recent non-NULL previous order
- Option to modify or reorder
- 5 PM cutoff time the day before delivery
- Reminder system for customers who haven't ordered (1 Message day 3, 2 messages day 2, 2 messages, including final call day 1)