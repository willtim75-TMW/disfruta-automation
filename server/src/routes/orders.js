/**
 * POST /api/orders — receive webform submission → create QBO invoice
 */
import { Router } from "express";
import { config, qboConfigured } from "../config.js";
import { createInvoiceFromOrder } from "../qbo/invoices.js";

const router = Router();

function verifySecret(req) {
  if (!config.webhookSecret) return true;
  const header = req.get("X-Disfruta-Secret") || "";
  const bodySecret = req.body?.meta?.secret || "";
  return header === config.webhookSecret || bodySecret === config.webhookSecret;
}

/**
 * POST /api/orders
 * Body: order payload from webform (see make/sample-webhook-payload.json)
 */
router.post("/", async (req, res) => {
  try {
    if (!verifySecret(req)) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized — invalid or missing X-Disfruta-Secret",
      });
    }

    const payload = req.body || {};

    if (payload.declined) {
      return res.status(200).json({
        ok: true,
        declined: true,
        message: "Decline recorded — no invoice created",
        invoice: null,
      });
    }

    if (!qboConfigured()) {
      return res.status(503).json({
        ok: false,
        error:
          "QuickBooks Online is not configured. Set QBO credentials in server/.env and run npm run auth.",
        hint: "See server/README.md",
      });
    }

    const lineCount =
      payload?.order?.lineCount ??
      payload?.order?.lines?.length ??
      0;
    if (!lineCount) {
      return res.status(400).json({
        ok: false,
        error: "Order has no line items",
      });
    }

    const result = await createInvoiceFromOrder(payload);

    console.info(
      "[orders] Invoice created",
      result.invoiceId,
      "doc",
      result.docNumber,
      "total",
      result.totalAmt,
      "customer",
      result.customerId,
      result.createdCustomer ? "(new customer)" : ""
    );

    return res.status(201).json({
      ok: true,
      declined: false,
      message: "Invoice created in QuickBooks Online",
      invoice: {
        id: result.invoiceId,
        docNumber: result.docNumber,
        totalAmt: result.totalAmt,
        customerId: result.customerId,
        createdCustomer: result.createdCustomer,
        txnDate: result.invoice?.TxnDate,
        balance: result.invoice?.Balance,
      },
      // Echo minimal order summary for Make.com / logging
      order: {
        subtotal: payload?.order?.subtotal,
        lineCount,
        customerName: payload?.customer?.name,
      },
    });
  } catch (err) {
    console.error("[orders] Failed:", err.message);
    if (err.qbo) console.error("[orders] QBO fault:", JSON.stringify(err.qbo));
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status === 401 ? 502 : status >= 500 ? 502 : 400).json({
      ok: false,
      error: err.message || "Failed to create invoice",
      qbo: err.qbo || undefined,
    });
  }
});

/** GET /api/orders/health — config + token status (no secrets) */
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    qboConfigured: qboConfigured(),
    environment: config.qbo.environment,
  });
});

export default router;
