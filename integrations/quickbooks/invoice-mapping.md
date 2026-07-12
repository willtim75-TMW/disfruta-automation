# QuickBooks Online — Invoice mapping

Orders from the DisFruta webform go to **Make.com**, which creates the
QuickBooks Online invoice (native QBO module, or HTTP to optional `server/`).

## Flow

```
Webform submit
    → Make.com webhook  (system hub)
        → Google Sheets (order log)
        → QuickBooks Online · Create Invoice
        → Twilio confirmation / owner alert
```

Per MVP requirements, create invoices as draft / need-to-print so owners can
review before the driver delivers a physical copy.

See [README.md](./README.md) and [make/order-processing.md](../../make/order-processing.md).

## Required QBO entities

| Entity | Form field | Notes |
|--------|------------|-------|
| Customer | `customer.qboCustomerId` | Must exist in QBO (or created for new customers) |
| Item (Product/Service) | `order.lines[].qboItemId` | Inventory or non-inventory item |
| Invoice | Created by Order API | `PrintStatus: NeedToPrint` when draft mode on |

## Invoice JSON shape (from form)

See `make/sample-webhook-payload.json` → `quickbooks` object.

Minimal create body sent to QBO:

```json
{
  "CustomerRef": { "value": "24" },
  "TxnDate": "2026-07-15",
  "PrivateNote": "Customer notes…",
  "CustomerMemo": { "value": "Thank you for your order with DisFruta!" },
  "PrintStatus": "NeedToPrint",
  "Line": [
    {
      "DetailType": "SalesItemLineDetail",
      "Amount": 57.96,
      "Description": "Arepa de Choclo-4 Pack",
      "SalesItemLineDetail": {
        "Qty": 12,
        "UnitPrice": 4.83,
        "ItemRef": { "value": "10", "name": "Arepa de Choclo-4 Pack" }
      }
    }
  ]
}
```

API call:

`POST https://{sandbox-| }quickbooks.api.intuit.com/v3/company/{realmId}/invoice?minorversion=65`

## Item ID sync

Each line needs a real QBO Item Id in `qboItemId`:

1. Export Product/Service list from QBO (or Make **List Items**).
2. Store `SKU`, `Name`, `QBO Item Id`, `Price`, `Unit`, `Category`, `Staff Pick`, `Active` in Google Sheets **Products**.
3. Rebuild embedded catalog / refresh form so lines include those IDs.

## Customer ID sync

Personalized SMS links use `?customerId=<QBO Customer Id>`.

New customers: Order API creates a QBO Customer (or reuses DisplayName match), then invoices.

## Auth

- OAuth 2.0 via Intuit app (`server/.env` + `/auth/quickbooks`)
- Tokens in `server/.qbo-tokens.json` (gitignored); auto-refresh on expiry
- Scopes: Accounting

## Error handling

| Failure | API behavior |
|---------|----------------|
| Unknown CustomerRef | 400 / QBO fault returned to form |
| Missing ItemRef | 400 — fix Products sheet QBO Item IDs |
| Token expired | Refresh via refresh_token; re-auth if refresh fails |
| Declined order | 200, no invoice |

## References

- [QBO get started](https://developer.intuit.com/app/developer/qbo/docs/get-started)
- [OAuth 2.0](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Invoice entity](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice)
