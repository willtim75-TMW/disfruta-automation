/**
 * DisFruta order form
 * - Returning customers: personalized SMS link or phone lookup → previous order
 * - New customers: public form with business details → empty cart + catalog
 * - Admin: order on behalf of any client
 */
(function () {
  "use strict";

  const cfg = window.DISFRUTA_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  const isAdmin = document.body.dataset.mode === "admin";
  const I18n = window.DisfrutaI18n || null;
  const Auth = window.DisfrutaAuth || null;

  function t(key, vars) {
    return I18n && typeof I18n.t === "function" ? I18n.t(key, vars) : key;
  }
  function tn(n, oneKey, manyKey, vars) {
    if (I18n && typeof I18n.tn === "function") {
      return I18n.tn(n, oneKey, manyKey, vars);
    }
    return Number(n) === 1 ? t(oneKey, { n, ...vars }) : t(manyKey, { n, ...vars });
  }
  function activeLocale() {
    if (I18n && typeof I18n.getLocale === "function") return I18n.getLocale();
    return cfg.locale || "en-US";
  }
  function catLabel(c) {
    if (I18n && typeof I18n.categoryLabel === "function") {
      return I18n.categoryLabel(c);
    }
    return c;
  }
  function catChip(c) {
    if (I18n && typeof I18n.categoryChipShort === "function") {
      return I18n.categoryChipShort(c);
    }
    return c;
  }

  /** Normalize language codes from sheet / form / URL → "en" | "es" */
  function normalizeLang(raw) {
    if (I18n && typeof I18n.normalizeLang === "function") {
      return I18n.normalizeLang(raw) || "";
    }
    const v = String(raw || "")
      .trim()
      .toLowerCase();
    if (v.startsWith("es")) return "es";
    if (v.startsWith("en")) return "en";
    return "";
  }

  /**
   * Serve only the preferred language for the current session.
   * Returning / admin: customer.preferredLanguage (or SMS ?lang=).
   * New customer: contact.language from the one-time picker.
   */
  function applySessionLanguage(opts) {
    if (!I18n) return;
    const options = opts || {};
    if (state.isNewCustomer || state.orderMode === "new") {
      const lang =
        normalizeLang(state.contact.language) ||
        normalizeLang(params.get("lang")) ||
        "en";
      I18n.setLang(lang, {
        source: "new-user",
        persist: false,
        updateUrl: false,
        silent: options.silent !== false,
        force: Boolean(options.force),
      });
      return;
    }
    if (state.customer) {
      if (typeof I18n.applyCustomerLang === "function") {
        I18n.applyCustomerLang(state.customer, {
          source: options.source || "customer",
          silent: options.silent !== false,
          force: Boolean(options.force),
        });
      }
    }
  }

  const state = {
    products: [],
    productsBySku: new Map(),
    productsByName: new Map(),
    customers: [],
    customer: null,
    selectedContact: null,
    orders: [],
    existingOrder: null,
    /** @type {'none'|'new'|'returning'|'admin'} */
    orderMode: "none",
    isNewCustomer: false,
    contact: {
      name: "",
      phone: "",
      email: "",
      deliveryDay: "",
      frequency: "",
      frequencyNote: "",
      address: "",
      language: "en",
    },
    cart: new Map(),
    category: "All",
    /** When false and preferredCategories is set, browse is limited to those */
    browseAll: true,
    preferredCategories: [],
    search: "",
    notes: "",
    loading: true,
    submitting: false,
    submitted: false,
    dataSources: {},
    catalogMeta: {},
    /** Returning customer must pass phone/PIN gate before ordering */
    awaitingCustomerUnlock: false,
    /** Phone already verified via lookup — PIN-only gate may remain */
    unlockPhonePreverified: false,
    /** Admin: customer selected but phone not confirmed yet */
    adminCustomerLocked: false,
  };

  const els = {};

  // ---------- utils ----------
  function money(n) {
    return new Intl.NumberFormat(activeLocale(), {
      style: "currency",
      currency: cfg.currency || "USD",
    }).format(Number(n) || 0);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(activeLocale(), {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  function dayBeforeLabel(iso) {
    if (!iso) return t("notice.day_before");
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString(activeLocale(), {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  /** Display label for English weekday values stored in sheet / form */
  function weekdayLabel(day) {
    const key = {
      Monday: "contact.day_mon",
      Tuesday: "contact.day_tue",
      Wednesday: "contact.day_wed",
      Thursday: "contact.day_thu",
      Friday: "contact.day_fri",
      Saturday: "contact.day_sat",
    }[String(day || "").trim()];
    return key ? t(key) : day;
  }

  const WEEKDAY_INDEX = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  /** First weekday name from sheet values like "Tuesday, Friday". */
  function parseWeekdayIndex(day) {
    const first = String(day || "")
      .split(/[,/&]| and /i)[0]
      .trim()
      .toLowerCase();
    return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, first)
      ? WEEKDAY_INDEX[first]
      : null;
  }

  /**
   * Cadence length in days. "Every 3 weeks" is 21 so subsequent deliveries
   * stay on the same weekday three weeks apart.
   */
  function frequencyIntervalDays(frequency) {
    const f = String(frequency || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    if (!f) return 7;
    if (/\btwice\b/.test(f)) return 3;
    if (/\bother\b/.test(f)) return 7;
    if (/\b3\b/.test(f) && /week/.test(f)) return 21;
    if (/\bevery 3\b/.test(f)) return 21;
    if (/\bbi\b/.test(f) || /every 2/.test(f) || /fortnight/.test(f)) return 14;
    if (/month/.test(f) || (/every 4/.test(f) && /week/.test(f))) return 28;
    if (/week/.test(f)) return 7;
    return 7;
  }

  function startOfLocalDay(d) {
    const src = d instanceof Date ? d : new Date();
    return new Date(src.getFullYear(), src.getMonth(), src.getDate(), 12, 0, 0);
  }

  function addDays(d, n) {
    const x = startOfLocalDay(d);
    x.setDate(x.getDate() + (Number(n) || 0));
    return x;
  }

  function toIsoDate(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseIsoDate(iso) {
    const s = String(iso || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function sameLocalDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function nextWeekdayOnOrAfter(fromDate, weekdayIndex) {
    const d = startOfLocalDay(fromDate);
    if (weekdayIndex == null) return d;
    const delta = (weekdayIndex - d.getDay() + 7) % 7;
    return addDays(d, delta);
  }

  function isPastOrderCutoff(deliveryDate, now) {
    const today = startOfLocalDay(now);
    if (sameLocalDay(deliveryDate, today)) return true;
    const cutoffHour = Number(cfg.cutoffHour);
    const hour = Number.isFinite(cutoffHour) ? cutoffHour : 17;
    const tomorrow = addDays(today, 1);
    return sameLocalDay(deliveryDate, tomorrow) && now.getHours() >= hour;
  }

  function frequencyBadgeKey(frequency) {
    const f = String(frequency || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    if (!f) return "header.badge_weekly";
    if (/\btwice\b/.test(f)) return "header.badge_twice";
    if (/\bother\b/.test(f)) return "header.badge_other";
    if ((/\b3\b/.test(f) && /week/.test(f)) || /\bevery 3\b/.test(f)) {
      return "header.badge_3weeks";
    }
    if (/\bbi\b/.test(f) || /every 2/.test(f) || /fortnight/.test(f)) {
      return "header.badge_biweekly";
    }
    if (/month/.test(f) || (/every 4/.test(f) && /week/.test(f))) {
      return "header.badge_monthly";
    }
    return "header.badge_weekly";
  }

  /**
   * Next delivery date from preferred weekday + cadence.
   * Recurring (has lastOrderDate): last + interval (21 days for Every 3 weeks).
   * First order: next available preferred weekday, respecting 5 PM cutoff.
   */
  function computeNextDeliveryDate(opts) {
    const options = opts || {};
    const now =
      options.now instanceof Date && !Number.isNaN(options.now.getTime())
        ? options.now
        : new Date();
    const weekdayIndex = parseWeekdayIndex(
      options.dayOfWeek || options.preferredDay || ""
    );
    const interval = frequencyIntervalDays(options.frequency);
    const today = startOfLocalDay(now);
    const last = parseIsoDate(options.lastOrderDate);
    const hasLast = Boolean(last);

    let candidate;
    if (hasLast) {
      candidate = addDays(last, interval);
      while (candidate < today) candidate = addDays(candidate, interval);
    } else {
      candidate = today;
    }

    if (weekdayIndex != null) {
      candidate = nextWeekdayOnOrAfter(candidate, weekdayIndex);
    } else if (!hasLast) {
      return "";
    }

    const skipDays = hasLast ? interval : 7;
    if (isPastOrderCutoff(candidate, now)) {
      candidate = addDays(candidate, skipDays);
      if (weekdayIndex != null) {
        candidate = nextWeekdayOnOrAfter(candidate, weekdayIndex);
      }
    }
    return toIsoDate(candidate);
  }

  function applyComputedDeliveryDate(customer, opts) {
    if (!customer) return "";
    const options = opts || {};
    const existing = String(customer.nextDeliveryDate || "").trim();
    const existingDate = parseIsoDate(existing);
    const now = options.now instanceof Date ? options.now : new Date();
    if (
      existingDate &&
      !options.force &&
      !isPastOrderCutoff(existingDate, now) &&
      existingDate >= startOfLocalDay(now)
    ) {
      return existing;
    }
    const iso = computeNextDeliveryDate({
      dayOfWeek: customer.dayOfWeek,
      frequency: customer.frequency,
      lastOrderDate: customer.lastOrderDate,
      now,
    });
    if (iso) customer.nextDeliveryDate = iso;
    return iso || existing;
  }

  function isOtherFrequency(frequency) {
    return String(frequency || "").trim().toLowerCase() === "other";
  }

  function syncFrequencyOtherField() {
    const other = isOtherFrequency(
      state.contact.frequency || els.contactFrequency?.value
    );
    show(els.contactFrequencyOtherField, other);
    if (!other && els.contactFrequencyOther) {
      els.contactFrequencyOther.classList.remove("invalid");
    }
  }

  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function clampQty(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v) || v < 0) return 0;
    return Math.min(v, 9999);
  }

  /** Digits-only phone for matching Clients sheet values */
  function normalizePhone(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function phonesMatch(a, b) {
    const x = normalizePhone(a);
    const y = normalizePhone(b);
    if (!x || !y) return false;
    if (x === y) return true;
    // US: compare last 10 digits
    if (x.length >= 10 && y.length >= 10) {
      return x.slice(-10) === y.slice(-10);
    }
    return false;
  }

  function customerContacts(customer) {
    if (!customer || !Array.isArray(customer.contacts)) return [];
    return customer.contacts.filter(Boolean);
  }

  function contactKey(ct) {
    if (!ct) return "";
    return [
      String(ct.qboCustomerId || ""),
      normalizePhone(ct.phone),
      String(ct.contactName || "").trim().toLowerCase(),
    ].join("|");
  }

  function primaryContact(customer) {
    const list = customerContacts(customer);
    return list.find((c) => c.isPrimary) || list[0] || null;
  }

  function findContactByPhone(customer, phone) {
    return (
      customerContacts(customer).find((c) => phonesMatch(c.phone, phone)) ||
      null
    );
  }

  function resolveHintedContact(customer) {
    if (!customer) return null;
    const phoneHint =
      params.get("contactPhone") ||
      params.get("cphone") ||
      params.get("phone") ||
      "";
    const nameHint = String(
      params.get("contact") || params.get("contactName") || ""
    )
      .trim()
      .toLowerCase();
    const list = customerContacts(customer);
    if (phoneHint) {
      const byPhone = list.find((c) => phonesMatch(c.phone, phoneHint));
      if (byPhone) return byPhone;
    }
    if (nameHint) {
      const byName = list.find(
        (c) => String(c.contactName || "").trim().toLowerCase() === nameHint
      );
      if (byName) return byName;
    }
    return primaryContact(customer);
  }

  function selectContact(contact) {
    state.selectedContact = contact || null;
  }

  function findCustomerByPhone(phone) {
    return (
      state.customers.find((c) => {
        if (c.active === false) return false;
        if (phonesMatch(c.phone, phone)) return true;
        return customerContacts(c).some((ct) => phonesMatch(ct.phone, phone));
      }) || null
    );
  }

  function parseCategoryList(raw) {
    if (
      window.DisfrutaSheets &&
      typeof window.DisfrutaSheets.parsePreferredCategories === "function"
    ) {
      return window.DisfrutaSheets.parsePreferredCategories(raw);
    }
    if (Array.isArray(raw)) return raw.flatMap(parseCategoryList);
    return String(raw || "")
      .split(/[,;|/\n]+/)
      .map((s) => s.replace(/^["'\s]+|["'\s]+$/g, "").trim())
      .filter(Boolean);
  }

  function catalogCategoryMap() {
    const map = new Map();
    (state.products || []).forEach((p) => {
      const c = String((p && p.category) || "General").trim() || "General";
      map.set(c.toLowerCase(), c);
    });
    return map;
  }

  function canonicalizeCategoryList(list) {
    const present = catalogCategoryMap();
    const out = [];
    const used = new Set();
    parseCategoryList(list).forEach((raw) => {
      const canon = present.get(String(raw || "").trim().toLowerCase());
      if (canon && !used.has(canon)) {
        out.push(canon);
        used.add(canon);
      }
    });
    return out;
  }

  function resolvePreferredCategories(customer) {
    const urlRaw =
      params.get("preferredCategories") ||
      params.get("categories") ||
      params.get("cats") ||
      "";
    const fromUrl = canonicalizeCategoryList(urlRaw);
    if (fromUrl.length) return fromUrl;
    return canonicalizeCategoryList(
      customer && customer.preferredCategories
    );
  }

  function applyPreferredCategoryScope(customer) {
    state.preferredCategories = resolvePreferredCategories(customer || null);
    state.browseAll = state.preferredCategories.length === 0;
    if (
      !state.browseAll &&
      state.category !== "All" &&
      state.preferredCategories.indexOf(state.category) === -1
    ) {
      state.category = "All";
    }
  }

  function hasPreferredFilter() {
    return !state.browseAll && state.preferredCategories.length > 0;
  }

  function scopedProducts() {
    if (!hasPreferredFilter()) return (state.products || []).slice();
    const allow = new Set(state.preferredCategories);
    return (state.products || []).filter((p) =>
      allow.has(String((p && p.category) || "General").trim() || "General")
    );
  }

  function findCustomerById(customerId) {
    return (
      state.customers.find(
        (c) =>
          String(c.qboCustomerId) === String(customerId) ||
          String(c.id) === String(customerId)
      ) || null
    );
  }

  function normalizeOrderDate(iso) {
    return String(iso || "").trim().slice(0, 10);
  }

  function findExistingOrder(qboId, deliveryDate) {
    const id = String(qboId || "").trim();
    const date = normalizeOrderDate(deliveryDate);
    if (!id || !date) return null;
    const blocking = new Set([
      "received",
      "submitted",
      "invoiced",
      "declined",
    ]);
    return (
      (state.orders || []).find((o) => {
        if (String(o.qboCustomerId) !== id) return false;
        if (normalizeOrderDate(o.deliveryDate) !== date) return false;
        const st = String(o.status || "").toLowerCase();
        if (st === "error") return false;
        if (o.declined || st === "declined") return true;
        return !st || blocking.has(st);
      }) || null
    );
  }

  function refreshExistingOrderState() {
    if (!state.customer || state.isNewCustomer) {
      state.existingOrder = null;
      return null;
    }
    state.existingOrder = findExistingOrder(
      state.customer.qboCustomerId,
      state.customer.nextDeliveryDate
    );
    return state.existingOrder;
  }

  async function reloadOrderLog() {
    if (
      !window.DisfrutaSheets ||
      typeof window.DisfrutaSheets.loadOrderLog !== "function"
    ) {
      return state.orders || [];
    }
    try {
      const orders = await window.DisfrutaSheets.loadOrderLog(cfg);
      if (Array.isArray(orders)) state.orders = orders;
    } catch (err) {
      console.warn("[DisFruta] Could not refresh Orders log:", err);
    }
    return state.orders || [];
  }

  function isDuplicateSubmitError(err) {
    if (!err) return false;
    if (Number(err.status) === 409) return true;
    const data = err.data || {};
    const code = String(data.code || data.error || "").toLowerCase();
    if (code.includes("duplicate")) return true;
    return /already (in|submitted|exists)|duplicate order/i.test(
      String(err.message || data.message || "")
    );
  }

  // ---------- data ----------
  async function initData() {
    if (
      !window.DisfrutaSheets ||
      typeof window.DisfrutaSheets.loadCatalog !== "function"
    ) {
      throw new Error("sheets.js failed to load — product catalog unavailable.");
    }

    const catalog = await window.DisfrutaSheets.loadCatalog(cfg);
    state.products = catalog.products || [];
    state.productsBySku = new Map(
      state.products.map((p) => [String(p.sku), p])
    );
    state.productsByName = new Map(
      state.products.map((p) => [String(p.name).trim().toLowerCase(), p])
    );
    state.customers = catalog.customers || [];
    state.orders = catalog.orders || [];
    state.dataSources = catalog.sources || {};
    state.catalogMeta = catalog.meta || {};

    console.info(
      "[DisFruta] Catalog loaded:",
      state.catalogMeta,
      "sources:",
      state.dataSources
    );

    resolveEntryMode();
  }

  /**
   * Decide how the visitor enters the form:
   *  - admin page
   *  - personalized link (?customerId=)
   *  - explicit new order (?new=1)
   *  - landing chooser (default)
   */
  function resolveEntryMode() {
    const customerId =
      params.get("customerId") ||
      params.get("qboId") ||
      params.get("id") ||
      "";
    const wantNew =
      params.get("new") === "1" ||
      params.get("mode") === "new" ||
      params.get("type") === "new";

    if (isAdmin) {
      state.orderMode = "admin";
      state.isNewCustomer = false;
      state.customer = null;
      return;
    }

    if (customerId) {
      startReturningFromId(customerId);
      return;
    }

    if (wantNew && cfg.allowNewCustomers !== false) {
      startNewCustomer();
      return;
    }

    // Public landing — choose new vs returning
    state.orderMode = "none";
    state.customer = null;
    state.isNewCustomer = false;
  }

  function startNewCustomer() {
    state.orderMode = "new";
    state.isNewCustomer = true;
    const initialLang =
      normalizeLang(params.get("lang") || params.get("locale")) || "en";
    state.customer = {
      qboCustomerId: "",
      name: "",
      phone: "",
      email: "",
      frequency: "",
      dayOfWeek: "",
      nextDeliveryDate:
        params.get("deliveryDate") || params.get("nextDelivery") || "",
      preferredLanguage: initialLang,
      language: initialLang,
      previousOrder: [],
      active: true,
      isNew: true,
    };
    state.cart.clear();
    selectContact(null);
    state.existingOrder = null;
    applyPreferredCategoryScope(null);
    // Prefill contact from URL if Make/ads pass them
    state.contact = {
      name: params.get("name") || params.get("customerName") || "",
      phone: params.get("phone") || "",
      email: params.get("email") || "",
      deliveryDay: params.get("deliveryDay") || params.get("day") || "",
      frequency:
        params.get("frequency") || params.get("cadence") || "",
      frequencyNote:
        params.get("frequencyNote") ||
        params.get("frequency_note") ||
        params.get("cadenceNote") ||
        "",
      address: params.get("address") || "",
      language: initialLang,
    };
    syncContactToCustomer();
    const presetDelivery =
      params.get("deliveryDate") || params.get("nextDelivery") || "";
    if (presetDelivery) {
      state.customer.nextDeliveryDate = presetDelivery;
    } else {
      applyComputedDeliveryDate(state.customer, { force: true });
    }
    applySessionLanguage({ silent: true, source: "new-user" });
  }

  /**
   * Leave new-customer (or returning) flow and return to the landing chooser
   * so users can correct an accidental path selection.
   */
  function resetToLanding(opts) {
    const openReturning = Boolean(opts && opts.openReturning);
    state.orderMode = "none";
    state.isNewCustomer = false;
    state.customer = null;
    state.selectedContact = null;
    state.existingOrder = null;
    state.cart.clear();
    state.notes = "";
    state.search = "";
    state.category = "All";
    applyPreferredCategoryScope(null);
    state.awaitingCustomerUnlock = false;
    state.unlockPhonePreverified = false;
    state.adminCustomerLocked = false;
    state.contact = {
      name: "",
      phone: "",
      email: "",
      deliveryDay: "",
      frequency: "",
      frequencyNote: "",
      address: "",
      language: normalizeLang(params.get("lang")) || "en",
    };
    if (els.notesInput) els.notesInput.value = "";
    if (els.searchInput) els.searchInput.value = "";
    writeContactFields();
    // Landing uses default/URL language only (no customer preference yet)
    if (I18n) {
      I18n.setLang(state.contact.language, {
        source: "landing",
        silent: true,
        persist: false,
        updateUrl: false,
      });
    }
    // Drop deep-link params so landing doesn't auto-reenter new/returning mode
    try {
      const url = new URL(window.location.href);
      let dirty = false;
      [
        "new",
        "mode",
        "type",
        "customerId",
        "qboId",
        "id",
        "deliveryDate",
        "nextDelivery",
      ].forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          dirty = true;
        }
      });
      // Keep lang / token if present
      if (dirty) {
        window.history.replaceState(
          {},
          "",
          url.pathname + url.search + url.hash
        );
      }
      // Refresh params snapshot used by renderShell (customerId checks)
      for (const k of [...params.keys()]) params.delete(k);
      url.searchParams.forEach((v, k) => params.set(k, v));
    } catch (_) {
      /* ignore */
    }
    if (els.lookupHint) {
      els.lookupHint.textContent = "";
      els.lookupHint.className = "landing-hint";
    }
    if (els.lookupPhone) els.lookupPhone.value = "";
    show(els.returningPanel, openReturning);
    enterOrderUI();
    if (openReturning) {
      // enterOrderUI shows landing when orderMode is none
      requestAnimationFrame(() => {
        show(els.returningPanel, true);
        els.lookupPhone?.focus();
      });
    }
  }

  /** From new-customer path → returning phone lookup */
  function switchToReturningLookup() {
    resetToLanding({ openReturning: true });
    toast(t("toast.lookup_account"));
  }

  function startReturningFromId(customerId) {
    state.orderMode = "returning";
    state.isNewCustomer = false;

    let customer = findCustomerById(customerId);

    if (!customer) {
      // Link still works if Clients sheet is incomplete — trust Make.com params
      const n = params.get("name") || params.get("customerName");
      const lang =
        normalizeLang(params.get("lang") || params.get("locale")) || "en";
      customer = {
        qboCustomerId: String(customerId),
        name: n || `Customer #${customerId}`,
        phone: params.get("phone") || "",
        email: params.get("email") || "",
        frequency: "",
        dayOfWeek: "",
        nextDeliveryDate:
          params.get("deliveryDate") || params.get("nextDelivery") || "",
        preferredLanguage: lang,
        language: lang,
        preferredCategories: canonicalizeCategoryList(
          params.get("preferredCategories") ||
            params.get("categories") ||
            ""
        ),
        previousOrder: [],
        active: true,
      };
    }

    const d = params.get("deliveryDate") || params.get("nextDelivery");
    if (d) customer.nextDeliveryDate = d;
    const n = params.get("name") || params.get("customerName");
    if (n) customer.name = n;
    // SMS / Make URL is source of truth for this cycle; otherwise derive from cadence
    if (!d) applyComputedDeliveryDate(customer);
    // SMS can still override if sheet language is empty / Make passes lang
    const urlLang = normalizeLang(params.get("lang") || params.get("locale"));
    if (urlLang && !normalizeLang(customer.preferredLanguage || customer.language)) {
      customer.preferredLanguage = urlLang;
      customer.language = urlLang;
    }

    state.customer = customer;
    applyPreferredCategoryScope(customer);
    selectContact(resolveHintedContact(customer));
    refreshExistingOrderState();
    evaluateCustomerUnlock(customer, { phoneVerified: false });
    if (!state.awaitingCustomerUnlock) {
      seedCartFromPrevious(customer);
    } else {
      state.cart.clear();
    }
    applySessionLanguage({ silent: true, source: "customer-link" });
  }

  function startReturningCustomer(customer, opts) {
    state.orderMode = "returning";
    state.isNewCustomer = false;
    state.customer = customer;
    applyComputedDeliveryDate(customer);
    applyPreferredCategoryScope(customer);
    const phoneHint = opts && opts.phone ? opts.phone : "";
    selectContact(
      (phoneHint && findContactByPhone(customer, phoneHint)) ||
        resolveHintedContact(customer)
    );
    refreshExistingOrderState();
    evaluateCustomerUnlock(customer, opts || { phoneVerified: true });
    if (!state.awaitingCustomerUnlock) {
      seedCartFromPrevious(customer);
    } else {
      state.cart.clear();
    }
    applySessionLanguage({ silent: true, source: "customer-lookup" });
  }

  function resolveProduct(line) {
    if (!line) return null;
    if (line.sku && state.productsBySku.has(String(line.sku))) {
      return state.productsBySku.get(String(line.sku));
    }
    const name = (line.productName || line.name || "").trim().toLowerCase();
    if (name && state.productsByName?.has(name)) {
      return state.productsByName.get(name);
    }
    return null;
  }

  function seedCartFromPrevious(customer) {
    state.cart.clear();
    (customer.previousOrder || []).forEach((line) => {
      const p = resolveProduct(line);
      if (!p) return;
      const qty = clampQty(line.quantity);
      if (qty > 0) state.cart.set(p.sku, qty);
    });
  }

  function syncContactToCustomer() {
    if (!state.customer || !state.isNewCustomer) return;
    state.customer.name = state.contact.name.trim();
    state.customer.phone = state.contact.phone.trim();
    state.customer.email = state.contact.email.trim();
    state.customer.dayOfWeek = state.contact.deliveryDay.trim();
    state.customer.frequency = state.contact.frequency.trim();
    state.customer.frequencyNote = isOtherFrequency(state.contact.frequency)
      ? state.contact.frequencyNote.trim()
      : "";
    state.customer.address = state.contact.address.trim();
    const lang = normalizeLang(state.contact.language) || "en";
    state.customer.preferredLanguage = lang;
    state.customer.language = lang;
    applyComputedDeliveryDate(state.customer, { force: true });
  }

  function readContactFields() {
    state.contact = {
      name: (els.contactName?.value || "").trim(),
      phone: (els.contactPhone?.value || "").trim(),
      email: (els.contactEmail?.value || "").trim(),
      deliveryDay: (els.contactDeliveryDay?.value || "").trim(),
      frequency: (els.contactFrequency?.value || "").trim(),
      frequencyNote: (els.contactFrequencyOther?.value || "").trim(),
      address: (els.contactAddress?.value || "").trim(),
      language:
        normalizeLang(els.contactLanguage?.value) ||
        normalizeLang(state.contact.language) ||
        "en",
    };
    syncContactToCustomer();
  }

  function writeContactFields() {
    if (els.contactName) els.contactName.value = state.contact.name || "";
    if (els.contactPhone) els.contactPhone.value = state.contact.phone || "";
    if (els.contactEmail) els.contactEmail.value = state.contact.email || "";
    if (els.contactDeliveryDay)
      els.contactDeliveryDay.value = state.contact.deliveryDay || "";
    if (els.contactFrequency)
      els.contactFrequency.value = state.contact.frequency || "";
    if (els.contactFrequencyOther)
      els.contactFrequencyOther.value = state.contact.frequencyNote || "";
    if (els.contactAddress)
      els.contactAddress.value = state.contact.address || "";
    if (els.contactLanguage)
      els.contactLanguage.value =
        normalizeLang(state.contact.language) || "en";
    syncFrequencyOtherField();
  }

  function validateNewCustomerContact() {
    readContactFields();
    let ok = true;
    const mark = (el, bad) => {
      if (!el) return;
      el.classList.toggle("invalid", bad);
      if (bad) ok = false;
    };
    mark(els.contactName, !state.contact.name);
    mark(
      els.contactPhone,
      !state.contact.phone || normalizePhone(state.contact.phone).length < 7
    );
    if (state.contact.email) {
      mark(els.contactEmail, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email));
    } else if (els.contactEmail) {
      els.contactEmail.classList.remove("invalid");
    }
    const other = isOtherFrequency(state.contact.frequency);
    syncFrequencyOtherField();
    mark(els.contactFrequencyOther, other && !state.contact.frequencyNote);
    return ok;
  }

  // ---------- cart ----------
  function resolveSku(raw) {
    const sku = String(raw || "").trim();
    if (!sku) return "";
    if (state.productsBySku.has(sku)) return sku;
    // Case-insensitive fallback
    for (const key of state.productsBySku.keys()) {
      if (String(key).toLowerCase() === sku.toLowerCase()) return key;
    }
    return sku;
  }

  function setQty(sku, qty) {
    const key = resolveSku(sku);
    if (!key) return;
    const q = clampQty(qty);
    if (q <= 0) state.cart.delete(key);
    else state.cart.set(key, q);
    renderCart();
    renderBrowse();
    renderPromo();
    updateSummary();
  }

  function addQty(sku, delta) {
    const key = resolveSku(sku);
    const current = state.cart.get(key) || 0;
    setQty(key, current + Number(delta || 0));
  }

  function cartLines() {
    const lines = [];
    state.cart.forEach((qty, sku) => {
      const key = resolveSku(sku);
      const p = state.productsBySku.get(key);
      if (!p || qty <= 0) return;
      lines.push({
        sku: key,
        qboItemId: p.qboItemId || key,
        name: p.name,
        description: p.description || "",
        unit: p.unit || "ea",
        unitPrice: Number(p.price) || 0,
        quantity: qty,
        lineTotal: (Number(p.price) || 0) * qty,
        category: p.category || "General",
      });
    });
    return lines;
  }

  function cartTotal() {
    return cartLines().reduce((s, l) => s + l.lineTotal, 0);
  }

  function hasActiveSession() {
    if (isAdmin) {
      // Admin page is "active" once owner is signed in (or auth disabled)
      return isAdminOwnerSignedIn();
    }
    return (
      state.orderMode === "new" ||
      state.orderMode === "returning" ||
      Boolean(state.customer)
    );
  }

  function isAdminOwnerSignedIn() {
    if (!isAdmin) return false;
    if (!Auth || typeof Auth.isAdminAuthEnabled !== "function") return true;
    if (!Auth.isAdminAuthEnabled()) return true;
    return Boolean(Auth.getAdminSession());
  }

  function orderUiUnlocked() {
    if (isAdmin) {
      if (!state.customer) return false;
      return !state.adminCustomerLocked;
    }
    if (state.isNewCustomer || state.orderMode === "new") return true;
    if (state.orderMode === "returning" || state.customer) {
      return !state.awaitingCustomerUnlock;
    }
    return false;
  }

  function evaluateCustomerUnlock(customer, opts) {
    const options = opts || {};
    state.unlockPhonePreverified = Boolean(options.phoneVerified);
    if (!customer || !Auth || typeof Auth.customerNeedsUnlock !== "function") {
      state.awaitingCustomerUnlock = false;
      return;
    }
    // Phone lookup already proved phone; treat as unlocked for phone-only policy
    if (options.phoneVerified && Auth.customerHasPin && !Auth.customerHasPin(customer)) {
      const id = customer.qboCustomerId || customer.id;
      if (id && Auth.unlockCustomer) {
        Auth.unlockCustomer(id, { method: "phone-lookup" });
      }
      state.awaitingCustomerUnlock = false;
      return;
    }
    state.awaitingCustomerUnlock = Auth.customerNeedsUnlock(customer);
  }

  function goHome(opts) {
    if (isAdmin) {
      window.location.href = "./index.html";
      return;
    }
    const openReturning = Boolean(opts && opts.openReturning);
    resetToLanding({ openReturning });
    if (!openReturning) {
      toast(t("toast.home"));
    }
  }

  // ---------- render ----------
  function cacheEls() {
    [
      "app",
      "landing",
      "main",
      "customerName",
      "deliveryDate",
      "deliveryPill",
      "heroKicker",
      "heroTitle",
      "heroSubtitle",
      "cartList",
      "cartCount",
      "cartHeading",
      "cartSub",
      "promoTitle",
      "promoGrid",
      "promoSection",
      "searchInput",
      "searchScopeHint",
      "categoryTabs",
      "browseList",
      "browseCount",
      "browseSub",
      "browseScopeBar",
      "browseScopeCopy",
      "browseAllBtn",
      "browseToolbar",
      "browseToolbarLabel",
      "addCategoryAllBtn",
      "notesInput",
      "summaryCount",
      "summaryTotal",
      "submitBtn",
      "cutoffNotice",
      "successScreen",
      "errorScreen",
      "loadingScreen",
      "adminSelect",
      "declineBtn",
      "declineBtnTop",
      "declineBtnBar",
      "declineSection",
      "declineFooter",
      "headerBadge",
      "contactSection",
      "contactName",
      "contactPhone",
      "contactEmail",
      "contactDeliveryDay",
      "contactFrequency",
      "contactFrequencyOther",
      "contactFrequencyOtherField",
      "contactLanguage",
      "contactAddress",
      "startNewBtn",
      "startReturningBtn",
      "returningPanel",
      "lookupPhone",
      "lookupBtn",
      "lookupHint",
      "modeSwitchNew",
      "modeSwitchReturning",
      "switchToReturningBtn",
      "switchToLandingFromNewBtn",
      "switchToLandingBtn",
      "logoHomeBtn",
      "customerUnlockSection",
      "customerUnlockSub",
      "customerUnlockPhoneField",
      "customerUnlockPinField",
      "customerUnlockPhone",
      "customerUnlockPin",
      "customerUnlockBtn",
      "customerUnlockHint",
      "adminGate",
      "adminUsername",
      "adminPassword",
      "adminLoginBtn",
      "adminGateHint",
      "adminLogoutBtn",
      "adminPhoneConfirm",
      "adminCustomerPhone",
      "adminUnlockCustomerBtn",
      "adminPhoneHint",
      "orderContactSection",
      "orderContactSelect",
      "alreadyOrderedSection",
      "alreadyOrderedHeading",
      "alreadyOrderedBody",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function show(el, on) {
    if (!el) return;
    el.classList.toggle("hidden", !on);
  }

  function renderShell() {
    show(els.loadingScreen, state.loading);
    if (state.loading) return;

    if (state.submitted) {
      show(els.main, false);
      show(els.landing, false);
      show(els.adminGate, false);
      show(els.successScreen, true);
      show(els.errorScreen, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      return;
    }

    // Admin owner gate
    if (isAdmin && !isAdminOwnerSignedIn()) {
      show(els.adminGate, true);
      show(els.main, false);
      show(els.landing, false);
      show(els.adminLogoutBtn, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      return;
    }

    if (isAdmin) {
      show(els.adminGate, false);
      show(els.adminLogoutBtn, Auth && Auth.isAdminAuthEnabled && Auth.isAdminAuthEnabled());
    }

    if (!hasActiveSession()) {
      show(els.landing, true);
      show(els.main, false);
      show(els.adminGate, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      return;
    }

    show(els.landing, false);
    show(els.main, true);

    const isNew = state.isNewCustomer || state.orderMode === "new";
    const unlocked = orderUiUnlocked();
    const needsCustomerUnlock =
      !isAdmin && state.awaitingCustomerUnlock && Boolean(state.customer);
    const orderLocked = Boolean(state.existingOrder);
    const showOrderChrome = unlocked && !needsCustomerUnlock;

    show(els.customerUnlockSection, needsCustomerUnlock);
    if (needsCustomerUnlock) {
      const needsPin =
        Auth && Auth.customerHasPin && Auth.customerHasPin(state.customer);
      const pinOnly = needsPin && state.unlockPhonePreverified;
      show(els.customerUnlockPhoneField, !pinOnly);
      show(els.customerUnlockPinField, needsPin);
      if (els.customerUnlockSub) {
        els.customerUnlockSub.textContent = pinOnly
          ? t("unlock.sub_pin_only")
          : needsPin
            ? t("unlock.sub_pin")
            : t("unlock.sub_phone");
      }
    }

    document
      .querySelector(".summary-bar")
      ?.classList.toggle("hidden", !showOrderChrome || orderLocked);

    // Order body: cart / browse / notes / cutoff (marked data-order-body in HTML, or class)
    document.querySelectorAll("[data-order-body]").forEach((el) => {
      show(el, showOrderChrome && !orderLocked);
    });

    const contacts = customerContacts(state.customer);
    const showContactPicker =
      showOrderChrome &&
      !orderLocked &&
      !isNew &&
      contacts.length > 1;
    show(els.orderContactSection, showContactPicker);
    if (showContactPicker) renderOrderContactSelect();

    show(els.alreadyOrderedSection, showOrderChrome && orderLocked);
    if (showOrderChrome && orderLocked && els.alreadyOrderedBody) {
      const dateLabel =
        formatDate(state.customer?.nextDeliveryDate) !== "—"
          ? formatDate(state.customer.nextDeliveryDate)
          : weekdayLabel(state.customer?.dayOfWeek) ||
            t("decline.period_fallback");
      const declined = Boolean(
        state.existingOrder.declined ||
          String(state.existingOrder.status || "").toLowerCase() ===
            "declined"
      );
      els.alreadyOrderedBody.textContent = declined
        ? t("already.body_declined", { date: dateLabel })
        : t("already.body", { date: dateLabel });
    }

    show(els.contactSection, isNew && !isAdmin);
    // Allow leaving accidental "new customer" path
    show(els.modeSwitchNew, isNew && !isAdmin);
    // Returning (phone path or locked SMS link) can return home
    show(
      els.modeSwitchReturning,
      !isAdmin &&
        state.orderMode === "returning" &&
        (!params.get("customerId") || state.awaitingCustomerUnlock)
    );

    // Decline: unlocked returning / admin only
    const canDeclinePeriod =
      Boolean(state.customer) &&
      !isNew &&
      showOrderChrome &&
      !orderLocked &&
      (state.orderMode === "returning" || state.orderMode === "admin" || isAdmin);
    show(els.declineSection, canDeclinePeriod);
    show(els.declineFooter, canDeclinePeriod);
    show(els.declineBtn, canDeclinePeriod);
    show(els.declineBtnTop, canDeclinePeriod);
    show(els.declineBtnBar, canDeclinePeriod);

    if (isAdmin) {
      show(
        els.adminPhoneConfirm,
        Boolean(state.customer) && state.adminCustomerLocked
      );
    }

    if (els.headerBadge) {
      if (isAdmin) els.headerBadge.textContent = t("header.badge_admin");
      else if (isNew) els.headerBadge.textContent = t("header.badge_new");
      else
        els.headerBadge.textContent = t(
          frequencyBadgeKey(state.customer?.frequency)
        );
    }

    if (els.heroKicker) {
      els.heroKicker.textContent = isNew
        ? t("hero.kicker_welcome")
        : isAdmin
          ? t("hero.kicker_ordering")
          : t("hero.kicker_hello");
    }

    if (els.heroSubtitle) {
      els.heroSubtitle.textContent = isNew
        ? t("hero.subtitle_new")
        : t("hero.subtitle");
    }

    if (els.cartHeading) {
      els.cartHeading.textContent = isNew
        ? t("cart.heading")
        : t("cart.heading_previous");
    }
    if (els.cartSub) {
      const hasStaffPicks = staffPickProducts().length > 0;
      els.cartSub.textContent = isNew
        ? hasStaffPicks
          ? t("cart.sub_new_picks")
          : t("cart.sub_new")
        : t("cart.sub_returning");
    }

    if (isNew) {
      writeContactFields();
      const displayName =
        state.contact.name || state.customer?.name || t("hero.new_customer");
      if (els.customerName) els.customerName.textContent = displayName;
      if (els.deliveryDate) {
        const computed = state.customer?.nextDeliveryDate;
        if (computed && formatDate(computed) !== "—") {
          els.deliveryDate.textContent = formatDate(computed);
        } else if (state.contact.deliveryDay) {
          els.deliveryDate.textContent = weekdayLabel(
            state.contact.deliveryDay
          );
        } else {
          els.deliveryDate.textContent = t("hero.tbd");
        }
      }
      if (els.cutoffNotice) {
        els.cutoffNotice.innerHTML = `
          <p class="notice-primary"><strong>${t("notice.cutoff")}</strong></p>
          <p class="notice-secondary">${t("notice.new_review")}</p>
        `;
      }
    } else if (state.customer) {
      if (els.customerName) els.customerName.textContent = state.customer.name;
      if (
        els.heroSubtitle &&
        state.selectedContact &&
        state.selectedContact.contactName &&
        !isAdmin
      ) {
        els.heroSubtitle.textContent = t("order_contact.as", {
          name: state.selectedContact.contactName,
        });
      }
      if (els.deliveryDate) {
        const label =
          formatDate(state.customer.nextDeliveryDate) !== "—"
            ? formatDate(state.customer.nextDeliveryDate)
            : weekdayLabel(state.customer.dayOfWeek) || "—";
        els.deliveryDate.textContent = label;
      }
      if (els.cutoffNotice) {
        const noticeHtml = state.customer.nextDeliveryDate
          ? t("notice.cutoff_on", {
              day: dayBeforeLabel(state.customer.nextDeliveryDate),
            })
          : t("notice.cutoff_before");
        els.cutoffNotice.innerHTML = `
          <p class="notice-primary"><strong>${noticeHtml}</strong></p>
        `;
      }
    } else if (isAdmin && els.customerName) {
      els.customerName.textContent = t("hero.select_customer");
      if (els.deliveryDate) els.deliveryDate.textContent = "—";
    }

    // Staff Picks visibility is handled in renderPromo()
  }

  function renderOrderContactSelect() {
    if (!els.orderContactSelect) return;
    const list = customerContacts(state.customer);
    const selectedKey = contactKey(state.selectedContact);
    els.orderContactSelect.innerHTML = list
      .map((ct) => {
        const key = contactKey(ct);
        const name = ct.contactName || t("order_contact.unnamed");
        const phone = ct.phone ? ` · ${ct.phone}` : "";
        const primary = ct.isPrimary
          ? ` (${t("order_contact.primary")})`
          : "";
        return `<option value="${escapeAttr(key)}">${escapeHtml(
          name + phone + primary
        )}</option>`;
      })
      .join("");
    if (selectedKey) els.orderContactSelect.value = selectedKey;
    if (els.orderContactSelect.dataset.bound === "1") return;
    els.orderContactSelect.dataset.bound = "1";
    els.orderContactSelect.addEventListener("change", () => {
      const key = els.orderContactSelect.value;
      const match =
        customerContacts(state.customer).find((ct) => contactKey(ct) === key) ||
        null;
      selectContact(match);
      if (els.heroSubtitle && match && match.contactName && !isAdmin) {
        els.heroSubtitle.textContent = t("order_contact.as", {
          name: match.contactName,
        });
      }
    });
  }

  function renderAdminSelect() {
    if (!els.adminSelect) return;
    const prev = els.adminSelect.value;
    const options = [
      `<option value="">${escapeHtml(t("admin.select_placeholder"))}</option>`,
      ...state.customers
        .filter((c) => c.active !== false)
        .map(
          (c) =>
            `<option value="${escapeAttr(c.qboCustomerId)}">${escapeHtml(
              c.name
            )} (QBO #${escapeHtml(String(c.qboCustomerId))})</option>`
        ),
    ];
    els.adminSelect.innerHTML = options.join("");
    if (prev) els.adminSelect.value = prev;
    if (els.adminSelect.dataset.bound === "1") return;
    els.adminSelect.dataset.bound = "1";
    els.adminSelect.addEventListener("change", () => {
      const id = els.adminSelect.value;
      state.customer =
        state.customers.find((c) => String(c.qboCustomerId) === String(id)) ||
        null;
      state.orderMode = "admin";
      state.isNewCustomer = false;
      state.cart.clear();
      if (els.adminCustomerPhone) els.adminCustomerPhone.value = "";
      if (els.adminPhoneHint) {
        els.adminPhoneHint.textContent = "";
        els.adminPhoneHint.className = "landing-hint";
      }

      if (state.customer) {
        applyComputedDeliveryDate(state.customer);
        applyPreferredCategoryScope(state.customer);
        selectContact(primaryContact(state.customer));
        refreshExistingOrderState();
      } else {
        selectContact(null);
        state.existingOrder = null;
        applyPreferredCategoryScope(null);
      }

      if (!state.customer) {
        state.adminCustomerLocked = false;
      } else if (
        Auth &&
        Auth.requireAdminCustomerPhone &&
        Auth.requireAdminCustomerPhone()
      ) {
        const already =
          Auth.isCustomerUnlocked &&
          Auth.isCustomerUnlocked(state.customer.qboCustomerId);
        state.adminCustomerLocked = !already;
        if (already) seedCartFromPrevious(state.customer);
      } else {
        state.adminCustomerLocked = false;
        seedCartFromPrevious(state.customer);
      }

      applySessionLanguage({ silent: true, source: "admin" });
      if (I18n && typeof I18n.applyDom === "function") I18n.applyDom();
      enterOrderUI();
    });
  }

  function renderCart() {
    if (!els.cartList) return;
    const lines = cartLines();
    if (els.cartCount)
      els.cartCount.textContent = tn(
        lines.length,
        "cart.items_one",
        "cart.items_many",
        { n: lines.length }
      );

    if (!lines.length) {
      const isNew = state.isNewCustomer || state.orderMode === "new";
      const hasStaffPicks = staffPickProducts().length > 0;
      els.cartList.innerHTML = `
        <div class="empty">
          <strong>${escapeHtml(
            isNew ? t("cart.empty_new") : t("cart.empty_returning")
          )}</strong>
          ${escapeHtml(
            isNew
              ? hasStaffPicks
                ? t("cart.empty_new_hint_picks")
                : t("cart.empty_new_hint")
              : t("cart.empty_returning_hint")
          )}
        </div>`;
      return;
    }

    els.cartList.innerHTML = lines
      .map((line) => {
        return `
        <div class="line-item" data-sku="${escapeAttr(line.sku)}">
          <div>
            <p class="item-name">${escapeHtml(line.name)}</p>
            ${
              line.description
                ? `<p class="item-desc">${escapeHtml(line.description)}</p>`
                : ""
            }
            <div class="item-meta">
              <span class="price">${money(line.unitPrice)}</span>
              <span>·</span>
              <span>${escapeHtml(line.unit)}</span>
            </div>
          </div>
          <div class="item-actions">
            <div class="line-subtotal">${money(line.lineTotal)}</div>
            <div class="qty" role="group" aria-label="${escapeAttr(
              t("cart.qty_for", { name: line.name })
            )}">
              <button type="button" data-action="dec" aria-label="${escapeAttr(
                t("cart.decrease")
              )}">−</button>
              <input type="number" inputmode="numeric" min="0" max="9999" value="${
                line.quantity
              }" aria-label="${escapeAttr(t("cart.quantity"))}" />
              <button type="button" data-action="inc" aria-label="${escapeAttr(
                t("cart.increase")
              )}">+</button>
            </div>
            <button type="button" class="btn-remove" data-action="remove">${escapeHtml(
              t("cart.remove")
            )}</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function staffPickProducts() {
    return scopedProducts().filter(
      (p) => p && p.staffPick && p.active !== false && (p.name || p.sku)
    );
  }

  function renderPromo() {
    const picks = staffPickProducts();
    // Hide entire Staff Picks block when sheet has none marked staff_pick
    // Also hide while customer/admin unlock is pending
    if (els.promoSection) {
      show(els.promoSection, picks.length > 0 && orderUiUnlocked());
    }
    if (!els.promoGrid) return;
    if (!picks.length) {
      els.promoGrid.innerHTML = "";
      return;
    }

    if (els.promoTitle) {
      // Prefer i18n; allow config override only when it is a custom non-default title
      const customTitle =
        cfg.promoTitle && cfg.promoTitle !== "Staff Picks" ? cfg.promoTitle : null;
      els.promoTitle.textContent = customTitle || t("promo.title");
    }

    const promoTag =
      cfg.promoTag && cfg.promoTag !== "This week" && cfg.promoTag !== "Staff Pick"
        ? cfg.promoTag
        : t("promo.tag");

    els.promoGrid.innerHTML = picks
      .map((p) => {
        const inCart = state.cart.has(p.sku);
        return `
        <article class="promo-card" data-sku="${escapeAttr(p.sku)}">
          <span class="tag">${escapeHtml(promoTag)}</span>
          <h4>${escapeHtml(p.name)}</h4>
          <p>${escapeHtml(p.description || p.unit || "")}</p>
          <div class="promo-footer">
            <span class="price">${money(p.price)} <small>/${escapeHtml(
          p.unit || "ea"
        )}</small></span>
            <button type="button" class="btn btn-add" data-action="promo-add">
              ${escapeHtml(inCart ? t("promo.add_more") : t("promo.add"))}
            </button>
          </div>
        </article>`;
      })
      .join("");
  }

  /**
   * Build full category list from catalog, ordered for UX:
   * Frozen Fruit Pulps first, Dry Food last, everything else between.
   */
  function categories() {
    const source = hasPreferredFilter()
      ? scopedProducts()
      : state.products;
    const present = new Set(
      source.map(
        (p) => String(p.category || "General").trim() || "General"
      )
    );

    const preferred = Array.isArray(cfg.categoryOrder)
      ? cfg.categoryOrder.slice()
      : [
          "Frozen Fruit Pulps 14 Oz",
          "Frozen Fruit Pulps 32 Oz",
          "Frozen Fruit Pulps 64 Oz",
          "Frozen Food",
          "Soda/Drinks",
          "Dry Food",
        ];

    const ordered = [];
    const used = new Set();

    // 1) Preferred order (only categories that exist in catalog)
    preferred.forEach((c) => {
      const name = String(c).trim();
      if (present.has(name) && !used.has(name)) {
        ordered.push(name);
        used.add(name);
      }
    });

    // 2) Any Frozen Fruit Pulps* not already listed (e.g. renamed sizes)
    Array.from(present)
      .filter((c) => /^frozen fruit pulps/i.test(c) && !used.has(c))
      .sort((a, b) => a.localeCompare(b))
      .forEach((c) => {
        // Insert after other fruit pulp entries, before non-pulp
        const lastPulpIdx = ordered.reduce(
          (idx, name, i) =>
            /^frozen fruit pulps/i.test(name) ? i : idx,
          -1
        );
        ordered.splice(lastPulpIdx + 1, 0, c);
        used.add(c);
      });

    // 3) Remaining categories (except Dry Food) alphabetically
    Array.from(present)
      .filter((c) => !used.has(c) && !/^dry food$/i.test(c))
      .sort((a, b) => a.localeCompare(b))
      .forEach((c) => {
        ordered.push(c);
        used.add(c);
      });

    // 4) Dry Food last
    Array.from(present)
      .filter((c) => /^dry food$/i.test(c) && !used.has(c))
      .forEach((c) => {
        ordered.push(c);
        used.add(c);
      });

    // Safety: anything still missing
    Array.from(present)
      .filter((c) => !used.has(c))
      .sort((a, b) => a.localeCompare(b))
      .forEach((c) => ordered.push(c));

    return ["All", ...ordered];
  }

  /** Shorter chip labels for long pulp category names (localized) */
  function categoryChipLabel(category) {
    return catChip(category || "All");
  }

  /** Fold accents and lowercase for resilient search (arepa, maíz, etc.) */
  function fold(s) {
    let out = String(s || "").toLowerCase();
    try {
      if (typeof out.normalize === "function") {
        out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }
    } catch (_) {
      /* ignore normalize failures */
    }
    return out
      .replace(/[^a-z0-9\s.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function productSearchBlob(p) {
    return fold(
      [p.name, p.description, p.sku, p.category, p.notes, p.unit]
        .filter(Boolean)
        .join(" ")
    );
  }

  /**
   * Search tokens must all appear (in any field).
   */
  function productMatchesSearch(p, query) {
    const q = fold(query);
    if (!q) return true;
    const blob = productSearchBlob(p);
    const tokens = q.split(" ").filter(Boolean);
    if (!tokens.length) return true;
    return tokens.every((t) => blob.includes(t));
  }

  function isSearching() {
    return String(state.search || "").trim().length > 0;
  }

  /**
   * Browse list filter:
   * - Preferred categories (unless Browse all) narrow the catalog first
   * - With search text → search within that catalog (chip ignored)
   * - Without search → selected category only (or All in scope)
   */
  function filteredProducts() {
    const catalog = scopedProducts().filter((p) => p && (p.name || p.sku));

    if (isSearching()) {
      const q = state.search.trim();
      return catalog.filter((p) => productMatchesSearch(p, q));
    }

    if (state.category && state.category !== "All") {
      return catalog.filter(
        (p) => String(p.category || "General").trim() === state.category
      );
    }
    return catalog;
  }

  function productsInCategory(category) {
    const catalog = scopedProducts();
    if (!category || category === "All") return catalog.slice();
    return catalog.filter(
      (p) => String(p.category || "General").trim() === category
    );
  }

  function categoryChipHtml(c) {
    const scoped = scopedProducts();
    const count =
      c === "All" ? scoped.length : productsInCategory(c).length;
    const label = categoryChipLabel(c);
    const fullLabel = catLabel(c);
    return `<button type="button" class="chip ${
      c === state.category ? "active" : ""
    }" data-category="${escapeAttr(c)}" title="${escapeAttr(
      t("browse.chip_title", { category: fullLabel, n: count })
    )}" aria-label="${escapeAttr(
      t("browse.chip_aria", { category: fullLabel, n: count })
    )}">${escapeHtml(
      label
    )} <span class="chip-count">(${count})</span></button>`;
  }

  /**
   * Layout:
   *  Row 1 — All + Frozen Fruit Pulps*
   *  Row 2 — Frozen Food, Soda/Drinks, Dry Food (+ any others)
   */
  function splitCategoryRows(cats) {
    const all = cats.filter((c) => c === "All");
    const rest = cats.filter((c) => c !== "All");
    const row1 = [
      ...all,
      ...rest.filter((c) => /^frozen fruit pulps/i.test(c)),
    ];
    const row2 = rest.filter((c) => !/^frozen fruit pulps/i.test(c));
    // Preferred second-row order: Frozen Food → Soda/Drinks → Dry Food → rest
    const row2Preferred = ["Frozen Food", "Soda/Drinks", "Dry Food"];
    const ordered2 = [];
    const used = new Set();
    row2Preferred.forEach((name) => {
      if (row2.includes(name)) {
        ordered2.push(name);
        used.add(name);
      }
    });
    row2
      .filter((c) => !used.has(c))
      .sort((a, b) => a.localeCompare(b))
      .forEach((c) => ordered2.push(c));
    return { row1, row2: ordered2 };
  }

  function renderCategoryTabs() {
    if (!els.categoryTabs) return;
    const cats = categories();
    const { row1, row2 } = splitCategoryRows(cats);
    els.categoryTabs.setAttribute(
      "data-category-count",
      String(cats.length)
    );
    els.categoryTabs.innerHTML = `
      <div class="category-row category-row-pulps" role="presentation">
        ${row1.map(categoryChipHtml).join("")}
      </div>
      <div class="category-row category-row-other" role="presentation">
        ${row2.map(categoryChipHtml).join("")}
      </div>`;
    syncBrowseScopeUi();
  }

  function syncBrowseScopeUi() {
    const hasPrefs = state.preferredCategories.length > 0;
    const filtered = hasPreferredFilter();
    show(els.browseScopeBar, hasPrefs && !state.isNewCustomer);
    if (els.browseAllBtn) {
      els.browseAllBtn.textContent = filtered
        ? t("browse.add_other")
        : t("browse.preferred_only");
    }
    if (els.browseScopeCopy) {
      els.browseScopeCopy.textContent = filtered
        ? t("browse.scope_preferred")
        : hasPrefs
          ? t("browse.scope_all")
          : "";
    }
    if (els.browseSub) {
      if (filtered) {
        els.browseSub.innerHTML = t("browse.sub_preferred");
      } else if (I18n && typeof I18n.t === "function") {
        els.browseSub.innerHTML = t("browse.sub");
      }
    }
    const searchLabel = els.searchInput
      ? document.querySelector('label[for="searchInput"]')
      : null;
    if (searchLabel) {
      searchLabel.textContent = filtered
        ? t("browse.search_label_preferred")
        : t("browse.search_label");
    }
    if (els.searchInput) {
      els.searchInput.setAttribute(
        "placeholder",
        filtered ? t("browse.search_ph_preferred") : t("browse.search_ph")
      );
    }
  }

  function renderBrowseToolbar(list) {
    if (!els.browseToolbar) return;
    const searching = state.search.trim().length > 0;
    const showCategoryAll =
      !searching && state.category !== "All" && list.length > 0;
    show(els.browseToolbar, showCategoryAll);
    if (els.browseToolbarLabel && showCategoryAll) {
      els.browseToolbarLabel.textContent = tn(
        list.length,
        "browse.toolbar_one",
        "browse.toolbar_many",
        { n: list.length, category: catLabel(state.category) }
      );
    }
  }

  function renderBrowse() {
    if (!els.browseList) return;
    // Full category / search results — no artificial cap
    const list = filteredProducts();
    const searching = isSearching();

    syncBrowseScopeUi();

    if (els.searchScopeHint) {
      if (searching && hasPreferredFilter()) {
        els.searchScopeHint.innerHTML = t("browse.scope_hint_preferred");
        show(els.searchScopeHint, true);
      } else {
        if (I18n && typeof I18n.t === "function") {
          els.searchScopeHint.innerHTML = t("browse.scope_hint");
        }
        show(
          els.searchScopeHint,
          searching && state.category && state.category !== "All"
        );
      }
    }

    if (els.browseCount) {
      if (searching) {
        els.browseCount.textContent = tn(
          list.length,
          hasPreferredFilter()
            ? "browse.matches_pref_one"
            : "browse.matches_one",
          hasPreferredFilter()
            ? "browse.matches_pref_many"
            : "browse.matches_many",
          { n: list.length }
        );
      } else if (state.category === "All") {
        els.browseCount.textContent = tn(
          list.length,
          "browse.products_one",
          "browse.products_many",
          { n: list.length }
        );
      } else {
        els.browseCount.textContent = t("browse.in_category", {
          n: list.length,
        });
      }
    }

    renderBrowseToolbar(list);

    if (!state.products.length) {
      els.browseList.innerHTML = `
        <div class="empty">
          <strong>${escapeHtml(t("browse.empty_loaded"))}</strong>
          ${escapeHtml(t("browse.empty_loaded_body"))}
        </div>`;
      return;
    }

    if (!list.length) {
      els.browseList.innerHTML = `
        <div class="empty">
          <strong>${escapeHtml(t("browse.empty_match"))}</strong>
          ${
            searching
              ? escapeHtml(
                  t("browse.empty_search", { q: state.search.trim() })
                )
              : escapeHtml(
                  t("browse.empty_category", {
                    category: catLabel(state.category),
                  })
                )
          }
          <p class="browse-empty-hint">${
            hasPreferredFilter()
              ? t("browse.empty_tip_preferred")
              : t("browse.empty_tip")
          }</p>
        </div>`;
      return;
    }

    els.browseList.innerHTML = list
      .map((p) => {
        const qty = state.cart.get(p.sku) || 0;
        const name = p.name || p.sku || t("browse.product_fallback");
        return `
        <div class="browse-row" data-sku="${escapeAttr(p.sku)}">
          <div>
            <p class="item-name">${escapeHtml(name)}</p>
            ${
              p.description && p.description !== name
                ? `<p class="item-desc">${escapeHtml(p.description)}</p>`
                : ""
            }
            <div class="item-meta">
              <span class="price">${money(p.price)}</span>
              <span>·</span>
              <span>${escapeHtml(p.unit || "ea")}</span>
              <span>·</span>
              <span>${escapeHtml(catLabel(p.category || ""))}</span>
              <span>·</span>
              <span>${escapeHtml(p.sku || "")}</span>
              ${
                qty
                  ? `<span>· ${escapeHtml(
                      t("browse.in_order", { n: qty })
                    )}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="browse-add">
            <input type="number" min="1" max="9999" value="1" aria-label="${escapeAttr(
              t("browse.qty_add")
            )}" />
            <button type="button" class="btn btn-add" data-action="browse-add">${escapeHtml(
              t("browse.add")
            )}</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function addAllInCategory(category) {
    const list = productsInCategory(category);
    if (!list.length) {
      toast(t("toast.no_in_category"));
      return;
    }
    let added = 0;
    list.forEach((p) => {
      if (!p?.sku) return;
      const current = state.cart.get(p.sku) || 0;
      // Qty 1 if new; keep existing qty if already on the order
      if (current <= 0) {
        state.cart.set(p.sku, 1);
        added += 1;
      }
    });
    renderCart();
    renderBrowse();
    renderPromo();
    updateSummary();
    if (added === 0) {
      toast(t("toast.all_already"));
    } else {
      toast(
        tn(added, "toast.added_from_cat_one", "toast.added_from_cat_many", {
          n: added,
          category: catLabel(category),
        })
      );
    }
  }

  function updateSummary() {
    const lines = cartLines();
    const total = cartTotal();
    if (els.summaryCount)
      els.summaryCount.textContent = tn(
        lines.length,
        "cart.items_one",
        "cart.items_many",
        { n: lines.length }
      );
    if (els.summaryTotal) els.summaryTotal.textContent = money(total);
    if (els.submitBtn) {
      const sessionOk =
        hasActiveSession() &&
        orderUiUnlocked() &&
        (state.customer || (isAdmin && state.customer) || state.isNewCustomer);
      els.submitBtn.disabled =
        state.submitting ||
        !sessionOk ||
        Boolean(state.existingOrder) ||
        lines.length === 0;
      els.submitBtn.textContent = state.submitting
        ? t("summary.submitting")
        : state.isNewCustomer
          ? t("summary.submit_first")
          : t("summary.submit");
    }
  }

  // ---------- events ----------
  function eventEl(e) {
    const t = e && e.target;
    if (!t) return null;
    if (t.nodeType === 1) return t; // Element
    return t.parentElement || null;
  }

  function closest(e, sel) {
    const el = eventEl(e);
    return el && el.closest ? el.closest(sel) : null;
  }

  function rowSku(row) {
    if (!row) return "";
    return (
      row.getAttribute("data-sku") ||
      row.dataset?.sku ||
      ""
    ).trim();
  }

  function enterOrderUI() {
    renderShell();
    renderCart();
    renderPromo();
    renderCategoryTabs();
    renderBrowse();
    updateSummary();
  }

  function bindEvents() {
    els.logoHomeBtn?.addEventListener("click", () => {
      goHome({ openReturning: false });
    });

    els.startNewBtn?.addEventListener("click", () => {
      if (cfg.allowNewCustomers === false) {
        toast(t("toast.new_disabled"));
        return;
      }
      startNewCustomer();
      enterOrderUI();
      els.contactName?.focus();
    });

    els.startReturningBtn?.addEventListener("click", () => {
      if (cfg.allowPhoneLookup === false) {
        toast(t("toast.use_sms_link"));
        return;
      }
      show(els.returningPanel, true);
      els.lookupPhone?.focus();
    });

    els.switchToReturningBtn?.addEventListener("click", () => {
      switchToReturningLookup();
    });

    els.switchToLandingFromNewBtn?.addEventListener("click", () => {
      goHome({ openReturning: false });
    });

    els.switchToLandingBtn?.addEventListener("click", () => {
      goHome({ openReturning: false });
    });

    // --- Admin owner login ---
    const tryAdminLogin = () => {
      if (!Auth || !Auth.loginAdmin) return;
      const result = Auth.loginAdmin(
        els.adminUsername?.value,
        els.adminPassword?.value
      );
      if (!result.ok) {
        if (els.adminGateHint) {
          els.adminGateHint.textContent = t("admin.login_error");
          els.adminGateHint.className = "landing-hint error";
        }
        return;
      }
      if (els.adminGateHint) {
        els.adminGateHint.textContent = "";
        els.adminGateHint.className = "landing-hint";
      }
      if (els.adminPassword) els.adminPassword.value = "";
      enterOrderUI();
      els.adminSelect?.focus();
    };
    els.adminLoginBtn?.addEventListener("click", tryAdminLogin);
    els.adminPassword?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryAdminLogin();
      }
    });
    els.adminUsername?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.adminPassword?.focus();
      }
    });
    els.adminLogoutBtn?.addEventListener("click", () => {
      if (Auth && Auth.logoutAdmin) Auth.logoutAdmin();
      state.customer = null;
      state.selectedContact = null;
      state.existingOrder = null;
      state.cart.clear();
      state.adminCustomerLocked = false;
      if (els.adminSelect) els.adminSelect.value = "";
      enterOrderUI();
      els.adminUsername?.focus();
    });

    const tryAdminUnlockCustomer = () => {
      if (!state.customer || !Auth || !Auth.verifyAdminCustomerPhone) return;
      const result = Auth.verifyAdminCustomerPhone(
        state.customer,
        els.adminCustomerPhone?.value
      );
      if (!result.ok) {
        if (els.adminPhoneHint) {
          els.adminPhoneHint.textContent =
            result.error === "no_phone_on_file"
              ? t("admin.phone_missing")
              : t("admin.phone_error");
          els.adminPhoneHint.className = "landing-hint error";
        }
        return;
      }
      state.adminCustomerLocked = false;
      seedCartFromPrevious(state.customer);
      if (els.adminPhoneHint) {
        els.adminPhoneHint.textContent = t("admin.phone_ok");
        els.adminPhoneHint.className = "landing-hint ok";
      }
      enterOrderUI();
    };
    els.adminUnlockCustomerBtn?.addEventListener("click", tryAdminUnlockCustomer);
    els.adminCustomerPhone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryAdminUnlockCustomer();
      }
    });

    // --- Customer phone / PIN unlock ---
    const tryCustomerUnlock = () => {
      if (!state.customer || !Auth || !Auth.verifyCustomerAccess) return;
      const phone = state.unlockPhonePreverified
        ? state.customer.phone
        : els.customerUnlockPhone?.value;
      const result = Auth.verifyCustomerAccess(state.customer, {
        phone,
        pin: els.customerUnlockPin?.value,
      });
      if (!result.ok) {
        if (els.customerUnlockHint) {
          els.customerUnlockHint.textContent =
            result.error === "pin"
              ? t("unlock.error_pin")
              : result.error === "phone"
                ? t("unlock.error_phone")
                : t("unlock.error_generic");
          els.customerUnlockHint.className = "landing-hint error";
        }
        return;
      }
      state.awaitingCustomerUnlock = false;
      seedCartFromPrevious(state.customer);
      if (els.customerUnlockHint) {
        els.customerUnlockHint.textContent = "";
        els.customerUnlockHint.className = "landing-hint";
      }
      enterOrderUI();
    };
    els.customerUnlockBtn?.addEventListener("click", tryCustomerUnlock);
    els.customerUnlockPin?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryCustomerUnlock();
      }
    });
    els.customerUnlockPhone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (els.customerUnlockPinField && !els.customerUnlockPinField.classList.contains("hidden")) {
          els.customerUnlockPin?.focus();
        } else {
          tryCustomerUnlock();
        }
      }
    });

    els.lookupBtn?.addEventListener("click", () => {
      const phone = els.lookupPhone?.value || "";
      if (normalizePhone(phone).length < 7) {
        if (els.lookupHint) {
          els.lookupHint.textContent = t("toast.invalid_phone");
          els.lookupHint.className = "landing-hint error";
        }
        return;
      }
      const match = findCustomerByPhone(phone);
      if (!match) {
        if (els.lookupHint) {
          els.lookupHint.innerHTML =
            escapeHtml(t("toast.no_account")) +
            (cfg.allowNewCustomers !== false
              ? `<button type="button" class="btn-ghost" id="lookupToNew">${escapeHtml(
                  t("toast.no_account_new")
                )}</button>`
              : escapeHtml(t("toast.no_account_sms")));
          els.lookupHint.className = "landing-hint error";
          document.getElementById("lookupToNew")?.addEventListener("click", () => {
            startNewCustomer();
            state.contact.phone = phone.trim();
            enterOrderUI();
          });
        }
        return;
      }
      if (els.lookupHint) {
        els.lookupHint.textContent = t("toast.welcome_back", {
          name: match.name,
        });
        els.lookupHint.className = "landing-hint ok";
      }
      startReturningCustomer(match, { phoneVerified: true, phone });
      enterOrderUI();
    });

    els.lookupPhone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.lookupBtn?.click();
      }
    });

    // Live-update new-customer header name / next delivery
    const onContactFieldChange = () => {
      if (!state.isNewCustomer) return;
      readContactFields();
      syncFrequencyOtherField();
      if (els.customerName) {
        els.customerName.textContent =
          state.contact.name || t("hero.new_customer");
      }
      if (els.deliveryDate) {
        const computed = state.customer?.nextDeliveryDate;
        if (computed && formatDate(computed) !== "—") {
          els.deliveryDate.textContent = formatDate(computed);
        } else if (state.contact.deliveryDay) {
          els.deliveryDate.textContent = weekdayLabel(
            state.contact.deliveryDay
          );
        } else {
          els.deliveryDate.textContent = t("hero.tbd");
        }
      }
      updateSummary();
    };
    [
      "contactName",
      "contactPhone",
      "contactEmail",
      "contactDeliveryDay",
      "contactFrequency",
      "contactFrequencyOther",
      "contactAddress",
    ].forEach((id) => {
      els[id]?.addEventListener("input", onContactFieldChange);
      els[id]?.addEventListener("change", onContactFieldChange);
    });

    // New customers only: one-time preferred language → switches entire UI
    els.contactLanguage?.addEventListener("change", () => {
      if (!state.isNewCustomer) return;
      readContactFields();
      if (I18n) {
        I18n.setLang(state.contact.language || "en", {
          source: "new-user",
          persist: false,
          updateUrl: false,
        });
      }
    });

    els.cartList?.addEventListener("click", (e) => {
      const row = closest(e, ".line-item");
      if (!row) return;
      const sku = rowSku(row);
      const actionEl = closest(e, "[data-action]");
      const action = actionEl?.getAttribute("data-action");
      if (action === "inc") addQty(sku, 1);
      if (action === "dec") addQty(sku, -1);
      if (action === "remove") {
        setQty(sku, 0);
        toast(t("toast.item_removed"));
      }
    });

    els.cartList?.addEventListener("change", (e) => {
      const el = eventEl(e);
      if (!el || el.tagName !== "INPUT") return;
      const row = el.closest(".line-item");
      if (!row) return;
      setQty(rowSku(row), el.value);
    });

    els.promoGrid?.addEventListener("click", (e) => {
      const btn = closest(e, "[data-action=promo-add]");
      if (!btn) return;
      const card = btn.closest("[data-sku]");
      if (!card) return;
      addQty(rowSku(card), 1);
      toast(t("toast.added"));
    });

    els.browseList?.addEventListener("click", (e) => {
      const btn = closest(e, "[data-action=browse-add]");
      if (!btn) return;
      e.preventDefault();
      const row = btn.closest(".browse-row");
      if (!row) return;
      const input = row.querySelector('input[type="number"]');
      const qty = clampQty(input?.value || 1) || 1;
      const sku = rowSku(row);
      if (!sku) {
        toast(t("toast.missing_sku"));
        return;
      }
      if (!state.productsBySku.has(resolveSku(sku))) {
        toast(t("toast.not_in_catalog"));
        console.warn("Unknown SKU", sku, "catalog size", state.products.length);
        return;
      }
      addQty(sku, qty);
      toast(t("toast.added"));
    });

    els.browseAllBtn?.addEventListener("click", () => {
      if (!state.preferredCategories.length) return;
      state.browseAll = !state.browseAll;
      if (
        !state.browseAll &&
        state.category !== "All" &&
        state.preferredCategories.indexOf(state.category) === -1
      ) {
        state.category = "All";
      }
      renderCategoryTabs();
      renderBrowse();
      renderPromo();
    });

    els.categoryTabs?.addEventListener("click", (e) => {
      const chip = closest(e, "[data-category]");
      if (!chip) return;
      state.category = chip.getAttribute("data-category") || "All";
      if (state.search) {
        state.search = "";
        if (els.searchInput) els.searchInput.value = "";
      }
      renderCategoryTabs();
      renderBrowse();
      if (els.browseList) els.browseList.scrollTop = 0;
    });

    const onSearch = (e) => {
      // Search the current catalog scope (preferred categories unless Browse all)
      state.search = (e.target && e.target.value) || "";
      renderBrowse();
      renderBrowseToolbar(filteredProducts());
    };
    els.searchInput?.addEventListener("input", onSearch);
    els.searchInput?.addEventListener("search", onSearch);
    els.searchInput?.addEventListener("keyup", onSearch);

    els.addCategoryAllBtn?.addEventListener("click", () => {
      if (state.category === "All") return;
      const n = productsInCategory(state.category).length;
      if (
        n > 15 &&
        !confirm(
          t("confirm.add_all", {
            n,
            category: catLabel(state.category),
          })
        )
      ) {
        return;
      }
      addAllInCategory(state.category);
    });

    els.notesInput?.addEventListener("input", (e) => {
      state.notes = e.target.value;
    });

    els.submitBtn?.addEventListener("click", () => submitOrder(false));

    const onDeclinePeriod = () => {
      if (!state.customer) {
        toast(
          isAdmin ? t("toast.select_customer") : t("toast.open_link_first")
        );
        return;
      }
      if (state.existingOrder) {
        toast(t("already.toast"));
        return;
      }
      const period =
        state.customer.nextDeliveryDate ||
        state.customer.dayOfWeek ||
        t("decline.period_fallback");
      const periodLabel =
        state.customer.nextDeliveryDate
          ? formatDate(state.customer.nextDeliveryDate)
          : period;
      const ok = confirm(
        t("decline.confirm", {
          name: state.customer.name,
          period: periodLabel,
        })
      );
      if (ok) submitOrder(true);
    };

    els.declineBtn?.addEventListener("click", onDeclinePeriod);
    els.declineBtnTop?.addEventListener("click", onDeclinePeriod);
    els.declineBtnBar?.addEventListener("click", onDeclinePeriod);

    // Re-apply UI copy when EN/ES is toggled
    window.addEventListener("disfruta:lang", () => {
      if (I18n && typeof I18n.applyDom === "function") I18n.applyDom();
      if (!state.loading && !state.submitted) {
        enterOrderUI();
      } else if (state.submitted) {
        renderShell();
      }
    });
  }

  // ---------- submit → Make.com (hub) → QBO / Sheets / Twilio ----------
  function buildPayload(declined) {
    if (state.isNewCustomer) readContactFields();
    const lines = declined ? [] : cartLines();
    const now = new Date().toISOString();
    const isNew = Boolean(state.isNewCustomer);
    const customerName = isNew
      ? state.contact.name
      : state.customer?.name || "";
    const customerId = isNew
      ? ""
      : String(state.customer?.qboCustomerId || "");

    return {
      version: cfg.payloadVersion || "1.2",
      source: isAdmin
        ? "admin-form"
        : isNew
          ? "new-customer-form"
          : "customer-form",
      isNewCustomer: isNew,
      declined: Boolean(declined),
      /** Full period skip — no invoice, stop reminders for this delivery window */
      declineOrderPeriod: Boolean(declined),
      submittedAt: now,
      createQuickBooksInvoice: !declined,
      customer: {
        qboCustomerId: customerId,
        name: customerName,
        phone: isNew
          ? state.contact.phone
          : state.selectedContact?.phone || state.customer?.phone || "",
        email: isNew
          ? state.contact.email
          : state.selectedContact?.email || state.customer?.email || "",
        contact: isNew
          ? null
          : state.selectedContact
            ? {
                name: state.selectedContact.contactName || "",
                phone: state.selectedContact.phone || "",
                email: state.selectedContact.email || "",
                isPrimary: Boolean(state.selectedContact.isPrimary),
              }
            : null,
        frequency: isNew
          ? state.contact.frequency
          : state.customer?.frequency || "",
        frequencyNote: isNew
          ? isOtherFrequency(state.contact.frequency)
            ? state.contact.frequencyNote
            : ""
          : state.customer?.frequencyNote || "",
        dayOfWeek: isNew
          ? state.contact.deliveryDay
          : state.customer?.dayOfWeek || "",
        address: isNew
          ? state.contact.address
          : state.customer?.address || "",
        preferredLanguage: isNew
          ? normalizeLang(state.contact.language) || "en"
          : normalizeLang(
              state.customer?.preferredLanguage || state.customer?.language
            ) ||
            (I18n && typeof I18n.getLang === "function"
              ? I18n.getLang()
              : "en"),
        preferredCategories: isNew
          ? []
          : (state.preferredCategories || []).slice(),
        isNew,
      },
      delivery: {
        nextDeliveryDate: state.customer?.nextDeliveryDate || "",
        preferredDay: isNew
          ? state.contact.deliveryDay
          : state.customer?.dayOfWeek || "",
        frequency: isNew
          ? state.contact.frequency
          : state.customer?.frequency || "",
        frequencyNote: isNew
          ? isOtherFrequency(state.contact.frequency)
            ? state.contact.frequencyNote
            : ""
          : state.customer?.frequencyNote || "",
        intervalDays: frequencyIntervalDays(
          isNew ? state.contact.frequency : state.customer?.frequency || ""
        ),
        cutoffNote: "5:00 PM day before delivery",
        /** Period identifier Make uses to stop reminders / match Orders log */
        orderPeriodKey:
          String(state.customer?.qboCustomerId || "") +
          "|" +
          String(
            state.customer?.nextDeliveryDate ||
              state.customer?.dayOfWeek ||
              ""
          ),
      },
      notes: [
        declined ? "DECLINED: no order this delivery period" : "",
        state.notes || "",
        isNew &&
        isOtherFrequency(state.contact.frequency) &&
        state.contact.frequencyNote
          ? `Frequency (Other): ${state.contact.frequencyNote}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      order: {
        lineCount: lines.length,
        subtotal: Number((declined ? 0 : cartTotal()).toFixed(2)),
        currency: cfg.currency || "USD",
        lines,
      },
      // Shape used by server/src/qbo/invoices.js → QBO POST /invoice
      quickbooks: {
        createCustomerIfMissing: isNew,
        CustomerRef: {
          value: customerId,
          name: customerName,
        },
        newCustomer: isNew
          ? {
              DisplayName: state.contact.name,
              PrimaryPhone: { FreeFormNumber: state.contact.phone },
              PrimaryEmailAddr: state.contact.email
                ? { Address: state.contact.email }
                : undefined,
              BillAddr: state.contact.address
                ? { Line1: state.contact.address }
                : undefined,
              Notes: [
                state.contact.deliveryDay
                  ? `Preferred delivery day: ${state.contact.deliveryDay}`
                  : "",
                state.contact.frequency
                  ? `Order frequency: ${
                      isOtherFrequency(state.contact.frequency) &&
                      state.contact.frequencyNote
                        ? `Other — ${state.contact.frequencyNote}`
                        : state.contact.frequency
                    }`
                  : "",
                state.contact.language
                  ? `Preferred language: ${
                      normalizeLang(state.contact.language) || "en"
                    }`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
            }
          : null,
        TxnDate: state.customer?.nextDeliveryDate || now.slice(0, 10),
        PrivateNote: state.notes || undefined,
        CustomerMemo: {
          value: "Thank you for your order with DisFruta!",
        },
        Line: lines.map((line, idx) => ({
          DetailType: "SalesItemLineDetail",
          Amount: Number(line.lineTotal.toFixed(2)),
          Description: line.name,
          LineNum: idx + 1,
          SalesItemLineDetail: {
            Qty: line.quantity,
            UnitPrice: line.unitPrice,
            ItemRef: {
              value: String(line.qboItemId || line.sku || ""),
              name: line.name,
            },
          },
        })),
      },
      meta: {
        demoMode: Boolean(
          cfg.demoMode && !cfg.orderApiUrl && !cfg.makeWebhookUrl
        ),
        userAgent: navigator.userAgent,
        url: window.location.href,
        token: params.get("token") || "",
        orderMode: state.orderMode,
        lang: I18n && typeof I18n.getLang === "function" ? I18n.getLang() : "en",
        locale: activeLocale(),
      },
    };
  }

  async function postJson(url, payload) {
    const headers = { "Content-Type": "application/json" };
    if (cfg.webhookSecret) {
      headers["X-Disfruta-Secret"] = cfg.webhookSecret;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        text.slice(0, 300) ||
        `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function submitOrder(declined) {
    if (isAdmin && !isAdminOwnerSignedIn()) {
      toast(t("admin.login_error"));
      return;
    }
    if (isAdmin && !state.customer) {
      toast(t("toast.select_customer"));
      return;
    }
    if (isAdmin && state.adminCustomerLocked) {
      toast(t("admin.customer_phone_help"));
      return;
    }
    if (!isAdmin && state.awaitingCustomerUnlock) {
      toast(t("unlock.heading"));
      return;
    }
    if (!isAdmin && state.orderMode === "none") {
      toast(t("toast.choose_first"));
      return;
    }
    if (state.isNewCustomer && !declined && !validateNewCustomerContact()) {
      toast(
        isOtherFrequency(state.contact.frequency) && !state.contact.frequencyNote
          ? t("toast.need_frequency_other")
          : t("toast.need_contact")
      );
      const focusEl =
        isOtherFrequency(state.contact.frequency) && !state.contact.frequencyNote
          ? els.contactFrequencyOther
          : els.contactName;
      (focusEl || els.contactSection)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      focusEl?.focus();
      return;
    }
    if (!state.isNewCustomer && !state.customer) {
      toast(t("toast.open_or_lookup"));
      return;
    }
    if (!declined && cartLines().length === 0) {
      toast(t("toast.need_items"));
      return;
    }
    // Decline is allowed with an empty cart
    if (declined && !state.customer && !isAdmin) {
      toast(t("toast.open_to_skip"));
      return;
    }
    if (!state.isNewCustomer && state.customer) {
      await reloadOrderLog();
      if (refreshExistingOrderState()) {
        state.submitting = false;
        enterOrderUI();
        toast(t("already.toast"));
        els.alreadyOrderedSection?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
    }
    if (state.submitting) return;

    state.submitting = true;
    updateSummary();

    const payload = buildPayload(declined);
    let submitResult = null;

    try {
      // Make.com is the orchestration hub (Sheets, QBO invoice, Twilio, …)
      const makeUrl = (cfg.makeWebhookUrl || "").trim();
      // Optional fallback only if Make is not configured
      const orderApi = (cfg.orderApiUrl || "").trim();
      const demoOnly = Boolean(cfg.demoMode) && !makeUrl && !orderApi;

      if (makeUrl) {
        submitResult = await postJson(makeUrl, payload);
        console.info("[DisFruta] Make.com webhook accepted order:", submitResult);
      } else if (orderApi) {
        // Direct Order API only when Make is not the hub for this environment
        submitResult = await postJson(orderApi, payload);
        console.info("[DisFruta] Order API (direct) response:", submitResult);
      } else if (demoOnly) {
        console.info(
          "[DisFruta demo] Order payload for Make.com → QBO / Sheets / Twilio:",
          payload
        );
        await new Promise((r) => setTimeout(r, 500));
      } else {
        throw new Error(
          "Make.com webhook is not configured. Set makeWebhookUrl in js/config.js (see make/order-processing.md)."
        );
      }

      if (
        submitResult &&
        (submitResult.duplicate ||
          submitResult.duplicateOrder ||
          String(submitResult.code || submitResult.error || "")
            .toLowerCase()
            .includes("duplicate"))
      ) {
        const err = new Error(
          submitResult.message || submitResult.error || t("already.toast")
        );
        err.status = 409;
        err.data = submitResult;
        throw err;
      }

      state.submitted = true;
      state.submitting = false;
      renderShell();
      if (els.successScreen) {
        const nameRaw =
          state.isNewCustomer
            ? state.contact.name
            : state.customer?.name || t("success.name_fallback");
        const name = escapeHtml(nameRaw);
        let detail;
        const inv =
          submitResult?.invoice ||
          submitResult?.quickbooks?.invoice ||
          null;
        if (declined) {
          const when =
            state.customer?.nextDeliveryDate
              ? formatDate(state.customer.nextDeliveryDate)
              : t("success.when_period");
          detail = t("success.declined", { when: escapeHtml(when) });
        } else if (inv && inv.docNumber) {
          detail = t("success.with_invoice", {
            name,
            total: money(payload.order.subtotal),
            doc: escapeHtml(String(inv.docNumber)),
          });
        } else if (state.isNewCustomer) {
          detail = t("success.first_order", {
            name,
            total: money(payload.order.subtotal),
          });
        } else {
          detail = t("success.with_total", {
            name,
            total: money(payload.order.subtotal),
          });
        }
        els.successScreen.querySelector("[data-success-detail]").innerHTML =
          detail;
      }
    } catch (err) {
      console.error(err);
      state.submitting = false;
      if (isDuplicateSubmitError(err)) {
        if (!state.existingOrder) {
          state.existingOrder = {
            qboCustomerId: state.customer?.qboCustomerId || "",
            deliveryDate: state.customer?.nextDeliveryDate || "",
            status: "submitted",
            declined: Boolean(declined),
          };
        }
        enterOrderUI();
        toast(t("already.toast"));
        els.alreadyOrderedSection?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
      updateSummary();
      show(els.errorScreen, true);
      show(els.main, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      const msg = els.errorScreen?.querySelector("[data-error-detail]");
      if (msg) msg.textContent = err.message || t("error.generic");
    }
  }

  window.DisfrutaOrder = {
    retry() {
      show(els.errorScreen, false);
      show(els.main, true);
      document.querySelector(".summary-bar")?.classList.remove("hidden");
      updateSummary();
    },
    getState: () => state,
    buildPayload,
    startNewCustomer: () => {
      startNewCustomer();
      enterOrderUI();
    },
    resetToLanding: () => resetToLanding({ openReturning: false }),
    switchToReturning: () => switchToReturningLookup(),
    computeNextDeliveryDate,
    frequencyIntervalDays,
    findExistingOrder,
    hasPreferredFilter,
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  async function boot() {
    cacheEls();
    try {
      await initData();
      state.loading = false;
      if (isAdmin) renderAdminSelect();
      if (cfg.allowNewCustomers === false) show(els.startNewBtn, false);
      // Bind once before first paint so early clicks work
      bindEvents();
      // Apply preferred language once customer/session is known, then paint
      applySessionLanguage({ silent: true, force: true });
      if (I18n && typeof I18n.applyDom === "function") I18n.applyDom();
      renderShell();
      renderCart();
      renderPromo();
      renderCategoryTabs();
      renderBrowse();
      updateSummary();
      console.info(
        "[DisFruta] Ready — products:",
        state.products.length,
        "mode:",
        state.orderMode,
        "sources:",
        state.dataSources
      );
      if (!state.products.length) {
        toast(t("toast.no_products"));
      }
    } catch (err) {
      console.error(err);
      state.loading = false;
      show(els.loadingScreen, false);
      show(els.errorScreen, true);
      const msg = els.errorScreen?.querySelector("[data-error-detail]");
      if (msg) {
        msg.textContent =
          (err && err.message) || t("error.load_failed");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
