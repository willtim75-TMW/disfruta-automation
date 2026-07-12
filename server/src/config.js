import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function bool(v, fallback = false) {
  if (v == null || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  webhookSecret: process.env.ORDER_WEBHOOK_SECRET || "",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:8080")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  qbo: {
    clientId: process.env.QBO_CLIENT_ID || "",
    clientSecret: process.env.QBO_CLIENT_SECRET || "",
    redirectUri:
      process.env.QBO_REDIRECT_URI ||
      "http://localhost:3001/auth/quickbooks/callback",
    environment: (process.env.QBO_ENVIRONMENT || "sandbox").toLowerCase(),
    realmId: process.env.QBO_REALM_ID || "",
    accessToken: process.env.QBO_ACCESS_TOKEN || "",
    refreshToken: process.env.QBO_REFRESH_TOKEN || "",
    tokenExpiresAt: process.env.QBO_TOKEN_EXPIRES_AT || "",
    invoiceAsDraft: bool(process.env.QBO_INVOICE_AS_DRAFT, true),
    defaultTaxCode: process.env.QBO_DEFAULT_TAX_CODE || "",
    customerMemo:
      process.env.QBO_CUSTOMER_MEMO ||
      "Thank you for your order with DisFruta!",
  },
};

export function qboConfigured() {
  const q = config.qbo;
  return Boolean(
    q.clientId &&
      q.clientSecret &&
      q.realmId &&
      (q.accessToken || q.refreshToken)
  );
}
