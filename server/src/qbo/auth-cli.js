/**
 * CLI helper: print QuickBooks OAuth URL and instructions.
 * Full browser callback is handled by the running server at /auth/quickbooks/*
 *
 * Usage:
 *   cd server && npm run auth
 */
import { config } from "../config.js";
import { getAuthUri } from "./client.js";

if (!config.qbo.clientId || !config.qbo.clientSecret) {
  console.error(
    "Missing QBO_CLIENT_ID / QBO_CLIENT_SECRET in server/.env\n" +
      "Copy .env.example → .env and fill Intuit app credentials."
  );
  process.exit(1);
}

const uri = getAuthUri();
console.log(`
DisFruta → QuickBooks Online authorization
─────────────────────────────────────────
1. Start the API server in another terminal:
     cd server && npm start

2. Open this URL in your browser and sign in to QuickBooks:
     ${uri}

   Or visit: http://localhost:${config.port}/auth/quickbooks

3. After approving, tokens are saved to server/.qbo-tokens.json
   and the company realmId is stored automatically.

Environment: ${config.qbo.environment}
Redirect URI (must match Intuit app settings):
  ${config.qbo.redirectUri}
`);
