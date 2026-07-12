/**
 * DisFruta Order API
 * - Serves order intake from the webform
 * - Creates invoices in QuickBooks Online via official REST API
 * - OAuth connect flow for QBO
 */
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config, qboConfigured } from "./config.js";
import ordersRouter from "./routes/orders.js";
import {
  exchangeCode,
  getAuthUri,
  getTokenState,
} from "./qbo/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser tools (curl) with no Origin
      if (!origin) return cb(null, true);
      if (
        config.corsOrigins.includes(origin) ||
        config.corsOrigins.includes("*")
      ) {
        return cb(null, true);
      }
      // Dev convenience: any localhost port
      if (
        config.nodeEnv !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    allowedHeaders: ["Content-Type", "X-Disfruta-Secret"],
  })
);
app.use(express.json({ limit: "1mb" }));

// Optional: serve the webform from the same origin in production
const webformPath = path.join(__dirname, "..", "..", "webform");
app.use("/order", express.static(webformPath));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "disfruta-order-api",
    qbo: getTokenState(),
    qboConfigured: qboConfigured(),
  });
});

app.use("/api/orders", ordersRouter);

// --- QuickBooks OAuth ---
app.get("/auth/quickbooks", (_req, res) => {
  try {
    const uri = getAuthUri();
    res.redirect(uri);
  } catch (err) {
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

app.get("/auth/quickbooks/callback", async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const tokens = await exchangeCode(fullUrl);
    res.type("html").send(`<!DOCTYPE html>
<html><head><title>QBO Connected</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#222}
  code{background:#f4f4f4;padding:2px 6px;border-radius:4px}
  .ok{color:#1f7a34;font-weight:700}
</style></head><body>
  <p class="ok">✓ QuickBooks Online connected</p>
  <p>Realm (company) ID: <code>${tokens.realmId || "(see .env)"}</code></p>
  <p>Tokens saved to <code>server/.qbo-tokens.json</code>.</p>
  <p>You can close this window and submit a test order from the webform.</p>
  <p><a href="/health">API health</a></p>
</body></html>`);
  } catch (err) {
    console.error("[auth] callback failed:", err);
    res.status(500).send(`Authorization failed: ${err.message}`);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || "Server error" });
});

app.listen(config.port, () => {
  console.info(
    `[disfruta-order-api] http://localhost:${config.port}  qboConfigured=${qboConfigured()} env=${config.qbo.environment}`
  );
  console.info(
    `[disfruta-order-api] Webform (optional): http://localhost:${config.port}/order/`
  );
  console.info(
    `[disfruta-order-api] Connect QBO: http://localhost:${config.port}/auth/quickbooks`
  );
});
