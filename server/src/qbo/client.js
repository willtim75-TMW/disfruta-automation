/**
 * QuickBooks Online API client — OAuth2 + token refresh + REST helpers
 * Docs: https://developer.intuit.com/app/developer/qbo/docs/get-started
 */
import OAuthClient from "intuit-oauth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokenStorePath = path.join(__dirname, "..", "..", ".qbo-tokens.json");

let tokenState = {
  access_token: config.qbo.accessToken,
  refresh_token: config.qbo.refreshToken,
  expires_at: config.qbo.tokenExpiresAt
    ? Date.parse(config.qbo.tokenExpiresAt)
    : 0,
  realmId: config.qbo.realmId,
};

// Hydrate from disk if present (written by auth-cli / callback)
try {
  if (fs.existsSync(tokenStorePath)) {
    const saved = JSON.parse(fs.readFileSync(tokenStorePath, "utf8"));
    tokenState = { ...tokenState, ...saved };
  }
} catch (err) {
  console.warn("[QBO] Could not read token store:", err.message);
}

function oauthClient() {
  return new OAuthClient({
    clientId: config.qbo.clientId,
    clientSecret: config.qbo.clientSecret,
    environment: config.qbo.environment === "production" ? "production" : "sandbox",
    redirectUri: config.qbo.redirectUri,
  });
}

export function getAuthUri() {
  const client = oauthClient();
  return client.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: "disfruta-order-api",
  });
}

export function saveTokens(tokens) {
  tokenState = {
    access_token: tokens.access_token || tokenState.access_token,
    refresh_token: tokens.refresh_token || tokenState.refresh_token,
    expires_at:
      tokens.expires_at ||
      (tokens.expires_in
        ? Date.now() + Number(tokens.expires_in) * 1000
        : tokenState.expires_at),
    realmId: tokens.realmId || tokenState.realmId || config.qbo.realmId,
  };
  try {
    fs.writeFileSync(tokenStorePath, JSON.stringify(tokenState, null, 2));
  } catch (err) {
    console.warn("[QBO] Could not persist tokens:", err.message);
  }
  return tokenState;
}

export async function exchangeCode(url) {
  const client = oauthClient();
  const authResponse = await client.createToken(url);
  const token = authResponse.getToken();
  const realmId =
    new URL(url, "http://localhost").searchParams.get("realmId") ||
    token.realmId ||
    config.qbo.realmId;
  return saveTokens({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_in: token.expires_in,
    realmId,
  });
}

async function ensureAccessToken() {
  if (!tokenState.refresh_token && !tokenState.access_token) {
    throw new Error(
      "QuickBooks is not authorized. Run: cd server && npm run auth"
    );
  }

  const expiresSoon =
    !tokenState.expires_at || tokenState.expires_at < Date.now() + 60_000;

  if (tokenState.access_token && !expiresSoon) {
    return tokenState.access_token;
  }

  if (!tokenState.refresh_token) {
    throw new Error(
      "Access token expired and no refresh token is stored. Re-run npm run auth."
    );
  }

  const client = oauthClient();
  client.setToken({
    access_token: tokenState.access_token,
    refresh_token: tokenState.refresh_token,
    token_type: "bearer",
    expires_in: 3600,
    x_refresh_token_expires_in: 8726400,
  });

  const authResponse = await client.refresh();
  const token = authResponse.getToken();
  saveTokens({
    access_token: token.access_token,
    refresh_token: token.refresh_token || tokenState.refresh_token,
    expires_in: token.expires_in,
    realmId: tokenState.realmId,
  });
  console.info("[QBO] Access token refreshed");
  return tokenState.access_token;
}

function baseUrl() {
  return config.qbo.environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

/**
 * Low-level QBO REST call
 * @param {string} method
 * @param {string} resourcePath e.g. "/invoice" or "/query?query=..."
 * @param {object} [body]
 */
export async function qboRequest(method, resourcePath, body) {
  const accessToken = await ensureAccessToken();
  const realmId = tokenState.realmId || config.qbo.realmId;
  if (!realmId) {
    throw new Error("QBO_REALM_ID is missing (company id from OAuth).");
  }

  const url = `${baseUrl()}/v3/company/${realmId}${resourcePath}${
    resourcePath.includes("?") ? "&" : "?"
  }minorversion=65`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const fault =
      data?.Fault?.Error?.[0]?.Message ||
      data?.fault?.error?.[0]?.message ||
      text.slice(0, 400);
    const detail =
      data?.Fault?.Error?.[0]?.Detail ||
      data?.fault?.error?.[0]?.detail ||
      "";
    const err = new Error(
      `QBO ${method} ${resourcePath} failed (${res.status}): ${fault}${
        detail ? ` — ${detail}` : ""
      }`
    );
    err.status = res.status;
    err.qbo = data;
    throw err;
  }

  return data;
}

export function getTokenState() {
  return {
    hasAccessToken: Boolean(tokenState.access_token),
    hasRefreshToken: Boolean(tokenState.refresh_token),
    realmId: tokenState.realmId || config.qbo.realmId || null,
    expiresAt: tokenState.expires_at
      ? new Date(tokenState.expires_at).toISOString()
      : null,
    environment: config.qbo.environment,
  };
}
