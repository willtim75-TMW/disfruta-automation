/**
 * QuickBooks Online Customer helpers
 */
import { qboRequest } from "./client.js";

/**
 * @param {string} displayName
 * @returns {Promise<object|null>}
 */
export async function findCustomerByDisplayName(displayName) {
  const name = String(displayName || "").trim();
  if (!name) return null;
  // Escape single quotes for QBO query language
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = `select * from Customer where DisplayName = '${escaped}' maxresults 1`;
  const data = await qboRequest(
    "GET",
    `/query?query=${encodeURIComponent(query)}`
  );
  const rows = data?.QueryResponse?.Customer;
  if (!rows || !rows.length) return null;
  return Array.isArray(rows) ? rows[0] : rows;
}

/**
 * Create a QBO Customer for first-time webform orders.
 * @param {{ DisplayName: string, phone?: string, email?: string, address?: string, notes?: string }} input
 */
export async function createCustomer(input) {
  const DisplayName = String(input.DisplayName || "").trim();
  if (!DisplayName) throw new Error("DisplayName is required");

  const body = {
    DisplayName,
    CompanyName: DisplayName,
  };

  if (input.phone) {
    body.PrimaryPhone = { FreeFormNumber: String(input.phone) };
  }
  if (input.email) {
    body.PrimaryEmailAddr = { Address: String(input.email) };
  }
  if (input.address) {
    body.BillAddr = { Line1: String(input.address).slice(0, 500) };
  }
  if (input.notes) {
    body.Notes = String(input.notes).slice(0, 2000);
  }

  const data = await qboRequest("POST", "/customer", body);
  return data.Customer || data;
}
