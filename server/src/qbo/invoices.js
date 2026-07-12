/**
 * Build and create QuickBooks Online invoices from DisFruta order payloads.
 * API: POST /v3/company/{realmId}/invoice
 * https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice
 */
import { config } from "../config.js";
import { qboRequest } from "./client.js";
import { createCustomer, findCustomerByDisplayName } from "./customers.js";

/**
 * Normalize form order payload into a QBO Invoice create body.
 * @param {object} orderPayload — webform / Make.com order JSON
 */
export function buildInvoiceBody(orderPayload) {
  const customerId = String(
    orderPayload?.customer?.qboCustomerId ||
      orderPayload?.quickbooks?.CustomerRef?.value ||
      ""
  ).trim();

  const lines = Array.isArray(orderPayload?.order?.lines)
    ? orderPayload.order.lines
    : Array.isArray(orderPayload?.quickbooks?.Line)
      ? orderPayload.quickbooks.Line.map((l) => ({
          name: l.Description,
          description: l.Description,
          quantity: l.SalesItemLineDetail?.Qty,
          unitPrice: l.SalesItemLineDetail?.UnitPrice,
          lineTotal: l.Amount,
          qboItemId: l.SalesItemLineDetail?.ItemRef?.value,
          sku: l.SalesItemLineDetail?.ItemRef?.name,
        }))
      : [];

  if (!lines.length) {
    throw new Error("Order has no line items — cannot create invoice.");
  }

  const txnDate =
    orderPayload?.delivery?.nextDeliveryDate ||
    orderPayload?.quickbooks?.TxnDate ||
    new Date().toISOString().slice(0, 10);

  const privateNote = [
    orderPayload?.notes || orderPayload?.quickbooks?.PrivateNote || "",
    orderPayload?.source ? `Source: ${orderPayload.source}` : "",
    orderPayload?.isNewCustomer ? "New customer order" : "",
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 4000);

  const taxCode = config.qbo.defaultTaxCode;

  const invoiceLines = lines.map((line, idx) => {
    const qty = Number(line.quantity ?? line.Qty ?? 1) || 1;
    const unitPrice = Number(line.unitPrice ?? line.UnitPrice ?? 0) || 0;
    const amount =
      Number(line.lineTotal) ||
      Number((qty * unitPrice).toFixed(2));
    const itemId = String(
      line.qboItemId || line.itemId || line.ItemRef?.value || ""
    ).trim();
    const itemName = String(line.name || line.sku || line.description || "Item");

    if (!itemId) {
      throw new Error(
        `Line ${idx + 1} ("${itemName}") is missing qboItemId / QBO Item Id. ` +
          "Add QBO Item IDs to the Products sheet so invoices can be created."
      );
    }

    const detail = {
      Qty: qty,
      UnitPrice: unitPrice,
      ItemRef: {
        value: itemId,
        name: itemName,
      },
    };
    if (taxCode) {
      detail.TaxCodeRef = { value: taxCode };
    }

    return {
      DetailType: "SalesItemLineDetail",
      Amount: Number(amount.toFixed(2)),
      Description: String(line.description || line.name || itemName).slice(
        0,
        4000
      ),
      LineNum: idx + 1,
      SalesItemLineDetail: detail,
    };
  });

  const body = {
    CustomerRef: {
      value: customerId,
    },
    TxnDate: txnDate,
    Line: invoiceLines,
    CustomerMemo: {
      value:
        orderPayload?.quickbooks?.CustomerMemo?.value ||
        config.qbo.customerMemo,
    },
  };

  if (privateNote) body.PrivateNote = privateNote;

  // Draft vs. pending — QBO creates invoices as pending by default.
  // EmailStatus / PrintStatus help ops; full "draft" is a UI concept —
  // we set sparse metadata for owner review workflow.
  if (config.qbo.invoiceAsDraft) {
    body.PrintStatus = "NeedToPrint";
    body.EmailStatus = "NotSet";
  }

  if (!body.CustomerRef.value) {
    throw new Error(
      "Customer QBO ID is required to create an invoice. " +
        "For new customers, create the customer first."
    );
  }

  return body;
}

/**
 * Create invoice in QBO. For new customers, create Customer first when possible.
 * @param {object} orderPayload
 * @returns {Promise<{ invoice: object, customerId: string, createdCustomer: boolean }>}
 */
export async function createInvoiceFromOrder(orderPayload) {
  let customerId = String(
    orderPayload?.customer?.qboCustomerId ||
      orderPayload?.quickbooks?.CustomerRef?.value ||
      ""
  ).trim();
  let createdCustomer = false;

  if (!customerId && orderPayload?.isNewCustomer) {
    const name =
      orderPayload?.customer?.name ||
      orderPayload?.quickbooks?.newCustomer?.DisplayName;
    if (!name) {
      throw new Error("New customer order is missing customer name.");
    }

    // Reuse existing customer with same display name if found
    const existing = await findCustomerByDisplayName(name);
    if (existing?.Id) {
      customerId = String(existing.Id);
    } else {
      const created = await createCustomer({
        DisplayName: name,
        phone: orderPayload?.customer?.phone,
        email: orderPayload?.customer?.email,
        address: orderPayload?.customer?.address,
        notes: orderPayload?.customer?.dayOfWeek
          ? `Preferred delivery day: ${orderPayload.customer.dayOfWeek}`
          : "",
      });
      customerId = String(created.Id);
      createdCustomer = true;
    }

    // Inject into payload for invoice builder
    orderPayload = {
      ...orderPayload,
      customer: {
        ...(orderPayload.customer || {}),
        qboCustomerId: customerId,
      },
      quickbooks: {
        ...(orderPayload.quickbooks || {}),
        CustomerRef: {
          value: customerId,
          name: orderPayload?.customer?.name || name,
        },
      },
    };
  }

  const invoiceBody = buildInvoiceBody(orderPayload);
  const data = await qboRequest("POST", "/invoice", invoiceBody);
  const invoice = data.Invoice || data;

  return {
    invoice,
    customerId,
    createdCustomer,
    invoiceId: invoice.Id,
    docNumber: invoice.DocNumber,
    totalAmt: invoice.TotalAmt,
    syncToken: invoice.SyncToken,
  };
}
