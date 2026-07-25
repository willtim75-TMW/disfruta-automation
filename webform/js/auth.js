/**
 * DisFruta form access control (static-host friendly)
 *
 * Admin (admin.html):
 *   - Owner username + password (config.auth.admin.owners)
 *   - After login, unlock a customer by confirming their phone on file
 *
 * Customers (index.html):
 *   - Optional phone re-confirm on SMS deep links
 *   - Optional PIN from Clients sheet when set
 *
 * IMPORTANT: Browser-side checks deter casual access only. They are NOT a
 * substitute for host-level protection (Cloudflare Access, Netlify password,
 * Basic Auth, or a real server session). Never put production secrets in the
 * public repo; rotate demo passwords before go-live.
 */
(function (global) {
  "use strict";

  const ADMIN_KEY = "disfruta_admin_session_v1";
  const CUST_PREFIX = "disfruta_cust_unlock_v1_";

  function cfgAuth() {
    const cfg = global.DISFRUTA_CONFIG || {};
    return cfg.auth || {};
  }

  function adminCfg() {
    return cfgAuth().admin || {};
  }

  function customerCfg() {
    return cfgAuth().customer || {};
  }

  function normalizePhone(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function phonesMatch(a, b) {
    const x = normalizePhone(a);
    const y = normalizePhone(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.length >= 10 && y.length >= 10) {
      return x.slice(-10) === y.slice(-10);
    }
    return false;
  }

  function normalizePin(pin) {
    return String(pin || "").trim();
  }

  function isAdminAuthEnabled() {
    const a = adminCfg();
    if (a.enabled === false) return false;
    const owners = Array.isArray(a.owners) ? a.owners : [];
    return owners.some((o) => o && o.username && o.password);
  }

  function sessionHours() {
    const h = Number(adminCfg().sessionHours);
    return Number.isFinite(h) && h > 0 ? h : 8;
  }

  function readJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* private mode / quota */
    }
  }

  function removeKey(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) {
      /* ignore */
    }
  }

  function getAdminSession() {
    if (!isAdminAuthEnabled()) {
      return { ok: true, bypass: true, username: "open" };
    }
    const s = readJson(ADMIN_KEY);
    if (!s || !s.username || !s.exp) return null;
    if (Date.now() > Number(s.exp)) {
      removeKey(ADMIN_KEY);
      return null;
    }
    return s;
  }

  function loginAdmin(username, password) {
    const u = String(username || "").trim();
    const p = String(password || "");
    const owners = Array.isArray(adminCfg().owners) ? adminCfg().owners : [];
    const match = owners.find(
      (o) =>
        o &&
        String(o.username).trim().toLowerCase() === u.toLowerCase() &&
        String(o.password) === p
    );
    if (!match) return { ok: false, error: "invalid" };
    const exp = Date.now() + sessionHours() * 3600 * 1000;
    const session = {
      username: String(match.username).trim(),
      exp,
      at: Date.now(),
    };
    writeJson(ADMIN_KEY, session);
    return { ok: true, session };
  }

  function logoutAdmin() {
    removeKey(ADMIN_KEY);
  }

  function requireAdminCustomerPhone() {
    const a = adminCfg();
    // Default true when admin auth is on
    if (typeof a.requireCustomerPhone === "boolean") {
      return a.requireCustomerPhone;
    }
    return isAdminAuthEnabled();
  }

  function customerUnlockKey(customerId) {
    return CUST_PREFIX + String(customerId || "").trim();
  }

  function isCustomerUnlocked(customerId) {
    if (!customerId) return false;
    const s = readJson(customerUnlockKey(customerId));
    if (!s || !s.exp) return false;
    if (Date.now() > Number(s.exp)) {
      removeKey(customerUnlockKey(customerId));
      return false;
    }
    return true;
  }

  function unlockCustomer(customerId, meta) {
    if (!customerId) return;
    writeJson(customerUnlockKey(customerId), {
      exp: Date.now() + sessionHours() * 3600 * 1000,
      at: Date.now(),
      ...(meta || {}),
    });
  }

  function clearCustomerUnlock(customerId) {
    if (customerId) removeKey(customerUnlockKey(customerId));
  }

  function customerHasPin(customer) {
    return Boolean(normalizePin(customer && (customer.pin || customer.password || customer.accessPin)));
  }

  /**
   * Whether this returning customer must pass a verify step before ordering.
   */
  function customerNeedsUnlock(customer) {
    if (!customer) return false;
    const id = customer.qboCustomerId || customer.id;
    if (id && isCustomerUnlocked(id)) return false;

    const c = customerCfg();
    const pinRequired =
      c.requirePinIfSet !== false && customerHasPin(customer);
    const phoneRequired = Boolean(c.requirePhoneConfirm);

    // Always require phone when a PIN is set (PIN alone is weaker without channel binding)
    if (pinRequired) return true;
    if (phoneRequired) return true;
    return false;
  }

  /**
   * @returns {{ ok: boolean, error?: string }}
   */
  function verifyCustomerAccess(customer, { phone, pin } = {}) {
    if (!customer) return { ok: false, error: "no_customer" };

    const c = customerCfg();
    const pinOnFile = normalizePin(
      customer.pin || customer.password || customer.accessPin || ""
    );
    const pinRequired = c.requirePinIfSet !== false && Boolean(pinOnFile);
    const phoneRequired = Boolean(c.requirePhoneConfirm) || pinRequired;

    if (phoneRequired) {
      if (!phonesMatch(phone, customer.phone)) {
        return { ok: false, error: "phone" };
      }
    }

    if (pinRequired) {
      if (normalizePin(pin) !== pinOnFile) {
        return { ok: false, error: "pin" };
      }
    }

    const id = customer.qboCustomerId || customer.id;
    unlockCustomer(id, { method: pinRequired ? "phone+pin" : "phone" });
    return { ok: true };
  }

  /**
   * Admin unlocks a client account by confirming the phone on the Clients row.
   */
  function verifyAdminCustomerPhone(customer, phone) {
    if (!customer) return { ok: false, error: "no_customer" };
    if (!requireAdminCustomerPhone()) {
      const id = customer.qboCustomerId || customer.id;
      unlockCustomer(id, { method: "admin-open" });
      return { ok: true };
    }
    if (!customer.phone) {
      // No phone on file — allow with warning code (caller may still unlock)
      return { ok: false, error: "no_phone_on_file" };
    }
    if (!phonesMatch(phone, customer.phone)) {
      return { ok: false, error: "phone" };
    }
    const id = customer.qboCustomerId || customer.id;
    unlockCustomer(id, { method: "admin-phone" });
    return { ok: true };
  }

  global.DisfrutaAuth = {
    isAdminAuthEnabled,
    getAdminSession,
    loginAdmin,
    logoutAdmin,
    requireAdminCustomerPhone,
    isCustomerUnlocked,
    unlockCustomer,
    clearCustomerUnlock,
    customerNeedsUnlock,
    customerHasPin,
    verifyCustomerAccess,
    verifyAdminCustomerPhone,
    phonesMatch,
    normalizePhone,
  };
})(window);
