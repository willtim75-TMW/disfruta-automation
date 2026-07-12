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

  const state = {
    products: [],
    productsBySku: new Map(),
    productsByName: new Map(),
    customers: [],
    customer: null,
    /** @type {'none'|'new'|'returning'|'admin'} */
    orderMode: "none",
    isNewCustomer: false,
    contact: {
      name: "",
      phone: "",
      email: "",
      deliveryDay: "",
      address: "",
    },
    cart: new Map(),
    category: "All",
    search: "",
    notes: "",
    loading: true,
    submitting: false,
    submitted: false,
    dataSources: {},
    catalogMeta: {},
  };

  const els = {};

  // ---------- utils ----------
  function money(n) {
    return new Intl.NumberFormat(cfg.locale || "en-US", {
      style: "currency",
      currency: cfg.currency || "USD",
    }).format(Number(n) || 0);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(cfg.locale || "en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  function dayBeforeLabel(iso) {
    if (!iso) return "the day before delivery";
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString(cfg.locale || "en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
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

  function findCustomerByPhone(phone) {
    return (
      state.customers.find(
        (c) => c.active !== false && phonesMatch(c.phone, phone)
      ) || null
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
    state.customer = {
      qboCustomerId: "",
      name: "",
      phone: "",
      email: "",
      frequency: "",
      dayOfWeek: "",
      nextDeliveryDate:
        params.get("deliveryDate") || params.get("nextDelivery") || "",
      previousOrder: [],
      active: true,
      isNew: true,
    };
    state.cart.clear();
    // Prefill contact from URL if Make/ads pass them
    state.contact = {
      name: params.get("name") || params.get("customerName") || "",
      phone: params.get("phone") || "",
      email: params.get("email") || "",
      deliveryDay: params.get("deliveryDay") || params.get("day") || "",
      address: params.get("address") || "",
    };
    syncContactToCustomer();
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
    state.cart.clear();
    state.notes = "";
    state.search = "";
    state.category = "All";
    state.contact = {
      name: "",
      phone: "",
      email: "",
      deliveryDay: "",
      address: "",
    };
    if (els.notesInput) els.notesInput.value = "";
    if (els.searchInput) els.searchInput.value = "";
    writeContactFields();
    // Drop forced ?new=1 so landing doesn't auto-reenter new mode
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("new") || url.searchParams.get("mode") === "new") {
        url.searchParams.delete("new");
        if (url.searchParams.get("mode") === "new") {
          url.searchParams.delete("mode");
        }
        if (url.searchParams.get("type") === "new") {
          url.searchParams.delete("type");
        }
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
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
    toast("Look up your account with the phone on file");
  }

  function startReturningFromId(customerId) {
    state.orderMode = "returning";
    state.isNewCustomer = false;

    let customer = findCustomerById(customerId);

    if (!customer) {
      // Link still works if Clients sheet is incomplete — trust Make.com params
      const n = params.get("name") || params.get("customerName");
      customer = {
        qboCustomerId: String(customerId),
        name: n || `Customer #${customerId}`,
        phone: params.get("phone") || "",
        email: params.get("email") || "",
        frequency: "",
        dayOfWeek: "",
        nextDeliveryDate:
          params.get("deliveryDate") || params.get("nextDelivery") || "",
        previousOrder: [],
        active: true,
      };
    }

    const d = params.get("deliveryDate") || params.get("nextDelivery");
    if (d) customer.nextDeliveryDate = d;
    const n = params.get("name") || params.get("customerName");
    if (n) customer.name = n;

    state.customer = customer;
    seedCartFromPrevious(customer);
  }

  function startReturningCustomer(customer) {
    state.orderMode = "returning";
    state.isNewCustomer = false;
    state.customer = customer;
    seedCartFromPrevious(customer);
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
    state.customer.address = state.contact.address.trim();
  }

  function readContactFields() {
    state.contact = {
      name: (els.contactName?.value || "").trim(),
      phone: (els.contactPhone?.value || "").trim(),
      email: (els.contactEmail?.value || "").trim(),
      deliveryDay: (els.contactDeliveryDay?.value || "").trim(),
      address: (els.contactAddress?.value || "").trim(),
    };
    syncContactToCustomer();
  }

  function writeContactFields() {
    if (els.contactName) els.contactName.value = state.contact.name || "";
    if (els.contactPhone) els.contactPhone.value = state.contact.phone || "";
    if (els.contactEmail) els.contactEmail.value = state.contact.email || "";
    if (els.contactDeliveryDay)
      els.contactDeliveryDay.value = state.contact.deliveryDay || "";
    if (els.contactAddress)
      els.contactAddress.value = state.contact.address || "";
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
    return (
      isAdmin ||
      state.orderMode === "new" ||
      state.orderMode === "returning" ||
      Boolean(state.customer)
    );
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
      "switchToLandingBtn",
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
      show(els.successScreen, true);
      show(els.errorScreen, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      return;
    }

    if (!hasActiveSession()) {
      show(els.landing, true);
      show(els.main, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      return;
    }

    show(els.landing, false);
    show(els.main, true);
    document.querySelector(".summary-bar")?.classList.remove("hidden");

    const isNew = state.isNewCustomer || state.orderMode === "new";
    show(els.contactSection, isNew && !isAdmin);
    // Allow leaving accidental "new customer" path
    show(els.modeSwitchNew, isNew && !isAdmin);
    // Returning (from phone lookup, not forced SMS deep-link with only id) can go home
    show(
      els.modeSwitchReturning,
      !isAdmin && state.orderMode === "returning" && !params.get("customerId")
    );
    // Decline entire delivery period: returning customers + admin (when a client is selected)
    const canDeclinePeriod =
      Boolean(state.customer) &&
      !isNew &&
      (state.orderMode === "returning" || state.orderMode === "admin" || isAdmin);
    show(els.declineSection, canDeclinePeriod);
    show(els.declineFooter, canDeclinePeriod);
    show(els.declineBtn, canDeclinePeriod);
    show(els.declineBtnTop, canDeclinePeriod);
    show(els.declineBtnBar, canDeclinePeriod);

    if (els.headerBadge) {
      if (isAdmin) els.headerBadge.textContent = "Admin";
      else if (isNew) els.headerBadge.textContent = "New customer";
      else els.headerBadge.textContent = "Weekly order";
    }

    if (els.heroKicker) {
      els.heroKicker.textContent = isNew
        ? "Welcome"
        : isAdmin
          ? "Ordering for"
          : "Hello";
    }

    if (els.heroSubtitle) {
      els.heroSubtitle.textContent = isNew
        ? "Build your first order — search or browse products below."
        : "What would you like this week?";
    }

    if (els.cartHeading) {
      els.cartHeading.textContent = isNew
        ? "Your Order"
        : "Your Previous Order";
    }
    if (els.cartSub) {
      els.cartSub.textContent = isNew
        ? "Add items from Staff Picks or the catalog below."
        : "Adjust quantities or remove items. Your last order is pre-filled.";
    }

    if (isNew) {
      writeContactFields();
      const displayName =
        state.contact.name || state.customer?.name || "New customer";
      if (els.customerName) els.customerName.textContent = displayName;
      if (els.deliveryPill) {
        const day = state.contact.deliveryDay || "TBD";
        if (els.deliveryDate) els.deliveryDate.textContent = day;
      }
      if (els.cutoffNotice) {
        els.cutoffNotice.innerHTML = `Orders must be submitted by <strong>5:00 PM</strong> the day before delivery. New accounts are reviewed by DisFruta before the first delivery.`;
      }
    } else if (state.customer) {
      if (els.customerName) els.customerName.textContent = state.customer.name;
      if (els.deliveryDate) {
        const label =
          formatDate(state.customer.nextDeliveryDate) !== "—"
            ? formatDate(state.customer.nextDeliveryDate)
            : state.customer.dayOfWeek || "—";
        els.deliveryDate.textContent = label;
      }
      if (els.cutoffNotice) {
        els.cutoffNotice.innerHTML = `Orders must be submitted by <strong>5:00 PM</strong>${
          state.customer.nextDeliveryDate
            ? ` on <strong>${dayBeforeLabel(
                state.customer.nextDeliveryDate
              )}</strong> (the day before delivery)`
            : " the day before delivery"
        }.`;
      }
    } else if (isAdmin && els.customerName) {
      els.customerName.textContent = "Select a customer";
      if (els.deliveryDate) els.deliveryDate.textContent = "—";
    }

    // Staff Picks visibility is handled in renderPromo()
  }

  function renderAdminSelect() {
    if (!els.adminSelect) return;
    const options = [
      `<option value="">— Choose customer —</option>`,
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
    els.adminSelect.addEventListener("change", () => {
      const id = els.adminSelect.value;
      state.customer =
        state.customers.find((c) => String(c.qboCustomerId) === String(id)) ||
        null;
      state.orderMode = "admin";
      state.isNewCustomer = false;
      if (state.customer) seedCartFromPrevious(state.customer);
      else state.cart.clear();
      renderShell();
      renderCart();
      renderPromo();
      renderBrowse();
      updateSummary();
    });
  }

  function renderCart() {
    if (!els.cartList) return;
    const lines = cartLines();
    if (els.cartCount)
      els.cartCount.textContent = `${lines.length} item${
        lines.length === 1 ? "" : "s"
      }`;

    if (!lines.length) {
      const isNew = state.isNewCustomer || state.orderMode === "new";
      els.cartList.innerHTML = `
        <div class="empty">
          <strong>${isNew ? "Your cart is empty" : "No items yet"}</strong>
          ${
            isNew
              ? "Browse products below or tap a Staff Pick to start your first order."
              : "Your previous order will appear here when available. Add products below."
          }
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
            <div class="qty" role="group" aria-label="Quantity for ${escapeAttr(
              line.name
            )}">
              <button type="button" data-action="dec" aria-label="Decrease">−</button>
              <input type="number" inputmode="numeric" min="0" max="9999" value="${
                line.quantity
              }" aria-label="Quantity" />
              <button type="button" data-action="inc" aria-label="Increase">+</button>
            </div>
            <button type="button" class="btn-remove" data-action="remove">Remove</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function staffPickProducts() {
    return state.products.filter(
      (p) => p && p.staffPick && p.active !== false && (p.name || p.sku)
    );
  }

  function renderPromo() {
    const picks = staffPickProducts();
    // Hide entire Staff Picks block when sheet has none marked staff_pick
    if (els.promoSection) {
      show(els.promoSection, picks.length > 0);
    }
    if (!els.promoGrid) return;
    if (!picks.length) {
      els.promoGrid.innerHTML = "";
      return;
    }

    if (els.promoTitle) {
      els.promoTitle.textContent = cfg.promoTitle || "Staff Picks";
    }

    els.promoGrid.innerHTML = picks
      .map((p) => {
        const inCart = state.cart.has(p.sku);
        return `
        <article class="promo-card" data-sku="${escapeAttr(p.sku)}">
          <span class="tag">${escapeHtml(cfg.promoTag || "Staff Pick")}</span>
          <h4>${escapeHtml(p.name)}</h4>
          <p>${escapeHtml(p.description || p.unit || "")}</p>
          <div class="promo-footer">
            <span class="price">${money(p.price)} <small>/${escapeHtml(
          p.unit || "ea"
        )}</small></span>
            <button type="button" class="btn btn-add" data-action="promo-add">
              ${inCart ? "Add more" : "Add"}
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
    const present = new Set(
      state.products.map(
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

  /** Shorter chip labels for long pulp category names */
  function categoryChipLabel(category) {
    if (!category || category === "All") return category || "All";
    const m = category.match(/^Frozen Fruit Pulps\s+(.+)$/i);
    if (m) return `Fruit Pulps ${m[1]}`;
    return category;
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
   * - With search text → ALWAYS full catalog (category chip ignored)
   * - Without search → selected category only (or All)
   */
  function filteredProducts() {
    const catalog = state.products.filter((p) => p && (p.name || p.sku));

    // Typing in search box = global catalog search
    if (isSearching()) {
      const q = state.search.trim();
      return catalog.filter((p) => productMatchesSearch(p, q));
    }

    // No search: category browse
    if (state.category && state.category !== "All") {
      return catalog.filter(
        (p) => String(p.category || "General").trim() === state.category
      );
    }
    return catalog;
  }

  function productsInCategory(category) {
    if (!category || category === "All") return state.products.slice();
    return state.products.filter(
      (p) => String(p.category || "General").trim() === category
    );
  }

  function categoryChipHtml(c) {
    const count =
      c === "All" ? state.products.length : productsInCategory(c).length;
    const label = categoryChipLabel(c);
    return `<button type="button" class="chip ${
      c === state.category ? "active" : ""
    }" data-category="${escapeAttr(c)}" title="${escapeAttr(
      `${c} — ${count} products`
    )}" aria-label="${escapeAttr(`${c}, ${count} products`)}">${escapeHtml(
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
  }

  function renderBrowseToolbar(list) {
    if (!els.browseToolbar) return;
    const searching = state.search.trim().length > 0;
    const showCategoryAll =
      !searching && state.category !== "All" && list.length > 0;
    show(els.browseToolbar, showCategoryAll);
    if (els.browseToolbarLabel && showCategoryAll) {
      els.browseToolbarLabel.textContent = `${list.length} product${
        list.length === 1 ? "" : "s"
      } in ${state.category}`;
    }
  }

  function renderBrowse() {
    if (!els.browseList) return;
    // Full category / search results — no artificial cap
    const list = filteredProducts();
    const searching = isSearching();

    // Hint: search always spans all products
    if (els.searchScopeHint) {
      show(
        els.searchScopeHint,
        searching && state.category && state.category !== "All"
      );
    }

    if (els.browseCount) {
      if (searching) {
        els.browseCount.textContent = `${list.length} match${
          list.length === 1 ? "" : "es"
        } (all products)`;
      } else if (state.category === "All") {
        els.browseCount.textContent = `${list.length} products`;
      } else {
        els.browseCount.textContent = `${list.length} in category`;
      }
    }

    renderBrowseToolbar(list);

    if (!state.products.length) {
      els.browseList.innerHTML = `
        <div class="empty">
          <strong>No products loaded</strong>
          Check that the Google Sheet is shared as “Anyone with the link → Viewer”,
          then refresh. Fallback catalog may also be missing.
        </div>`;
      return;
    }

    if (!list.length) {
      els.browseList.innerHTML = `
        <div class="empty">
          <strong>No products match</strong>
          ${
            searching
              ? `Nothing matched “${escapeHtml(state.search.trim())}”. Try fewer words or another spelling.`
              : `No active products in “${escapeHtml(state.category)}”.`
          }
          <p class="browse-empty-hint">Tip: choose <strong>All</strong> or clear the search box to browse everything.</p>
        </div>`;
      return;
    }

    els.browseList.innerHTML = list
      .map((p) => {
        const qty = state.cart.get(p.sku) || 0;
        const name = p.name || p.sku || "Product";
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
              <span>${escapeHtml(p.category || "")}</span>
              <span>·</span>
              <span>${escapeHtml(p.sku || "")}</span>
              ${qty ? `<span>· In order: ${qty}</span>` : ""}
            </div>
          </div>
          <div class="browse-add">
            <input type="number" min="1" max="9999" value="1" aria-label="Qty to add" />
            <button type="button" class="btn btn-add" data-action="browse-add">Add</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function addAllInCategory(category) {
    const list = productsInCategory(category);
    if (!list.length) {
      toast("No products in that category");
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
      toast("All products in this category are already on your order");
    } else {
      toast(`Added ${added} item${added === 1 ? "" : "s"} from ${category}`);
    }
  }

  function updateSummary() {
    const lines = cartLines();
    const total = cartTotal();
    if (els.summaryCount)
      els.summaryCount.textContent = `${lines.length} item${
        lines.length === 1 ? "" : "s"
      }`;
    if (els.summaryTotal) els.summaryTotal.textContent = money(total);
    if (els.submitBtn) {
      const sessionOk = hasActiveSession() && (state.customer || isAdmin);
      els.submitBtn.disabled =
        state.submitting || !sessionOk || lines.length === 0;
      els.submitBtn.textContent = state.submitting
        ? "Submitting…"
        : state.isNewCustomer
          ? "Submit first order"
          : "Submit Order";
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
    els.startNewBtn?.addEventListener("click", () => {
      if (cfg.allowNewCustomers === false) {
        toast("New customer orders are not enabled");
        return;
      }
      startNewCustomer();
      enterOrderUI();
      els.contactName?.focus();
    });

    els.startReturningBtn?.addEventListener("click", () => {
      if (cfg.allowPhoneLookup === false) {
        toast("Use the personalized link from your text message");
        return;
      }
      show(els.returningPanel, true);
      els.lookupPhone?.focus();
    });

    els.switchToReturningBtn?.addEventListener("click", () => {
      switchToReturningLookup();
    });

    els.switchToLandingBtn?.addEventListener("click", () => {
      resetToLanding({ openReturning: false });
      toast("Choose new or existing customer");
    });

    els.lookupBtn?.addEventListener("click", () => {
      const phone = els.lookupPhone?.value || "";
      if (normalizePhone(phone).length < 7) {
        if (els.lookupHint) {
          els.lookupHint.textContent = "Enter a valid phone number.";
          els.lookupHint.className = "landing-hint error";
        }
        return;
      }
      const match = findCustomerByPhone(phone);
      if (!match) {
        if (els.lookupHint) {
          els.lookupHint.innerHTML =
            "No account found for that number. " +
            (cfg.allowNewCustomers !== false
              ? `<button type="button" class="btn-ghost" id="lookupToNew">Start as a new customer</button>`
              : "Use the link from your SMS, or contact DisFruta.");
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
        els.lookupHint.textContent = `Welcome back, ${match.name}!`;
        els.lookupHint.className = "landing-hint ok";
      }
      startReturningCustomer(match);
      enterOrderUI();
    });

    els.lookupPhone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.lookupBtn?.click();
      }
    });

    // Live-update new-customer header name
    ["contactName", "contactPhone", "contactEmail", "contactDeliveryDay", "contactAddress"].forEach(
      (id) => {
        els[id]?.addEventListener("input", () => {
          if (!state.isNewCustomer) return;
          readContactFields();
          if (els.customerName) {
            els.customerName.textContent =
              state.contact.name || "New customer";
          }
          if (els.deliveryDate && state.contact.deliveryDay) {
            els.deliveryDate.textContent = state.contact.deliveryDay;
          }
          updateSummary();
        });
      }
    );

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
        toast("Item removed");
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
      toast("Added to order");
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
        toast("Could not add item (missing SKU)");
        return;
      }
      if (!state.productsBySku.has(resolveSku(sku))) {
        toast("Product not in catalog");
        console.warn("Unknown SKU", sku, "catalog size", state.products.length);
        return;
      }
      addQty(sku, qty);
      toast("Added to order");
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
      // Always search the full catalog; do not narrow by selected category
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
          `Add all ${n} products in “${state.category}” to your order (qty 1 each)?`
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
        toast(isAdmin ? "Select a customer first" : "Open your order link first");
        return;
      }
      const period =
        state.customer.nextDeliveryDate ||
        state.customer.dayOfWeek ||
        "this delivery period";
      const periodLabel =
        state.customer.nextDeliveryDate
          ? formatDate(state.customer.nextDeliveryDate)
          : period;
      const ok = confirm(
        `Skip the entire order period for ${state.customer.name}?\n\n` +
          `Delivery: ${periodLabel}\n\n` +
          `• No invoice will be created\n` +
          `• Reminders stop for this period\n` +
          `• You can still order again next cycle`
      );
      if (ok) submitOrder(true);
    };

    els.declineBtn?.addEventListener("click", onDeclinePeriod);
    els.declineBtnTop?.addEventListener("click", onDeclinePeriod);
    els.declineBtnBar?.addEventListener("click", onDeclinePeriod);
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
          : state.customer?.phone || "",
        email: isNew
          ? state.contact.email
          : state.customer?.email || "",
        frequency: state.customer?.frequency || "",
        dayOfWeek: isNew
          ? state.contact.deliveryDay
          : state.customer?.dayOfWeek || "",
        address: isNew
          ? state.contact.address
          : state.customer?.address || "",
        isNew,
      },
      delivery: {
        nextDeliveryDate: state.customer?.nextDeliveryDate || "",
        preferredDay: isNew
          ? state.contact.deliveryDay
          : state.customer?.dayOfWeek || "",
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
      notes: declined
        ? [state.notes, "DECLINED: no order this delivery period"]
            .filter(Boolean)
            .join(" · ")
        : state.notes || "",
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
              Notes: state.contact.deliveryDay
                ? `Preferred delivery day: ${state.contact.deliveryDay}`
                : undefined,
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
      throw new Error(msg);
    }
    return data;
  }

  async function submitOrder(declined) {
    if (isAdmin && !state.customer) {
      toast("Select a customer first");
      return;
    }
    if (!isAdmin && state.orderMode === "none") {
      toast("Choose new or returning customer first");
      return;
    }
    if (state.isNewCustomer && !declined && !validateNewCustomerContact()) {
      toast("Enter your business name and phone number");
      els.contactSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!state.isNewCustomer && !state.customer) {
      toast("Open your personalized link or look up your account");
      return;
    }
    if (!declined && cartLines().length === 0) {
      toast("Add at least one item — or skip this period if you need no delivery");
      return;
    }
    // Decline is allowed with an empty cart
    if (declined && !state.customer && !isAdmin) {
      toast("Open your personalized link to skip this period");
      return;
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

      state.submitted = true;
      state.submitting = false;
      renderShell();
      if (els.successScreen) {
        const name = escapeHtml(
          state.isNewCustomer
            ? state.contact.name
            : state.customer?.name || "there"
        );
        let detail;
        const inv =
          submitResult?.invoice ||
          submitResult?.quickbooks?.invoice ||
          null;
        if (declined) {
          const when =
            state.customer?.nextDeliveryDate
              ? formatDate(state.customer.nextDeliveryDate)
              : "this period";
          detail = `No order for <strong>${escapeHtml(
            when
          )}</strong>. We won’t send more reminders for this delivery window, and no invoice will be created. See you next cycle!`;
        } else if (inv && (inv.docNumber || inv.id)) {
          detail = `Thanks, ${name}! Your order totaling ${money(
            payload.order.subtotal
          )} was received${
            inv.docNumber
              ? ` — QuickBooks invoice <strong>#${escapeHtml(
                  String(inv.docNumber)
                )}</strong>`
              : ""
          }. You'll get a confirmation shortly.`;
        } else if (state.isNewCustomer) {
          detail = `Thanks, ${name}! Your first order totaling ${money(
            payload.order.subtotal
          )} was received. Our team will confirm your account and delivery details shortly.`;
        } else {
          detail = `Thanks, ${name}! Your order totaling ${money(
            payload.order.subtotal
          )} was received. You'll get a confirmation text shortly.`;
        }
        els.successScreen.querySelector("[data-success-detail]").innerHTML =
          detail;
      }
    } catch (err) {
      console.error(err);
      state.submitting = false;
      updateSummary();
      show(els.errorScreen, true);
      show(els.main, false);
      document.querySelector(".summary-bar")?.classList.add("hidden");
      const msg = els.errorScreen?.querySelector("[data-error-detail]");
      if (msg) msg.textContent = err.message || "Something went wrong.";
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
        toast("No products loaded — check console");
      }
    } catch (err) {
      console.error(err);
      state.loading = false;
      show(els.loadingScreen, false);
      show(els.errorScreen, true);
      const msg = els.errorScreen?.querySelector("[data-error-detail]");
      if (msg) {
        msg.textContent =
          (err && err.message) ||
          "Could not load order form. Serve via HTTP (python3 -m http.server) so products.json can load.";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
