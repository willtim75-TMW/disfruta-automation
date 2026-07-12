/**
 * Google Sheets data layer for DisFruta order form
 *
 * Supports (in priority order per resource):
 *  1. Direct published CSV URL
 *  2. Sheets API v4 (spreadsheetId + apiKey)
 *  3. Spreadsheet export URL built from spreadsheetId + gid
 *  4. Local JSON fallback (demo)
 *
 * Column headers are matched flexibly (see HEADER_ALIASES).
 * Schema: docs/data-schema.md
 */
(function (global) {
  "use strict";

  const HEADER_ALIASES = {
    // Products
    sku: ["sku", "product sku", "item sku", "code"],
    qboItemId: [
      "qbo item id",
      "qboitemid",
      "item id",
      "quickbooks item id",
      "qb item id",
      "product id",
    ],
    name: [
      "product name",
      "name",
      "product",
      "item name",
      "product/service full name",
      "product_service full name",
    ],
    description: ["description", "memo", "memo/description", "details", "desc"],
    category: ["category", "product category", "type"],
    price: [
      "price",
      "sales price",
      "unit price",
      "rate",
      "amount",
      "sale price",
    ],
    unit: ["unit", "uom", "units", "sell unit"],
    active: ["active", "is active", "status", "enabled"],
    staffPick: [
      "staff pick",
      "staff_pick",
      "staffpick",
      "promo",
      "promotional",
      "featured",
      "last chance",
    ],
    notes: ["notes", "note", "comments", "comment"],

    // Clients / Previous
    qboCustomerId: [
      "quickbooks id",
      "quickbooks id",
      "qbo customer id",
      "qbo id",
      "customer id",
      "qb id",
      "client id",
    ],
    customerName: ["customer name", "client name", "name", "customer", "client"],
    phone: ["phone number", "phone", "mobile", "cell", "telephone"],
    email: ["email", "e-mail", "email address"],
    frequency: ["frequency", "order frequency", "cadence"],
    dayOfWeek: [
      "day of week",
      "delivery day",
      "delivery_day",
      "day",
      "dow",
    ],
    lastOrderDate: ["last order date", "last order", "last ordered"],
    nextDeliveryDate: [
      "next delivery date",
      "next delivery",
      "delivery date",
      "next date",
    ],
    defaultQuantity: [
      "default quantity",
      "quantity",
      "qty",
      "default qty",
      "prev qty",
    ],
  };

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/[\u200b\ufeff]/g, "")
      // Underscores only — keep "/" so headers like product_name map cleanly
      // without mangling unrelated tokens
      .replace(/_+/g, " ")
      .replace(/\s+/g, " ");
  }

  function pick(row, field) {
    const aliases = HEADER_ALIASES[field] || [field];
    for (const a of aliases) {
      const key = normalizeHeader(a);
      if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== "") {
        return row[key];
      }
    }
    // also try exact field keys already normalized
    if (row[field] != null && row[field] !== "") return row[field];
    return "";
  }

  function truthy(v) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v == null || v === "") return false;
    const s = String(v).trim().toLowerCase();
    if (["no", "n", "false", "0", "inactive", "off", "disabled"].includes(s))
      return false;
    if (["yes", "y", "true", "1", "active", "on", "enabled", "x"].includes(s))
      return true;
    // blank active column treated as active
    return s === "" ? true : Boolean(s);
  }

  function numberish(v) {
    if (typeof v === "number") return v;
    const s = String(v || "")
      .replace(/[$,]/g, "")
      .trim();
    if (!s) return 0;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Minimal RFC4180-ish CSV parser (quoted fields, commas, newlines).
   */
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let i = 0;
    let inQuotes = false;
    const s = String(text || "").replace(/^\uFEFF/, "");

    while (i < s.length) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        cell += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && s[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
        continue;
      }
      cell += ch;
      i++;
    }
    // last cell
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    // drop trailing empty rows
    while (
      rows.length &&
      rows[rows.length - 1].every((c) => String(c).trim() === "")
    ) {
      rows.pop();
    }
    if (!rows.length) return [];

    const headers = rows[0].map(normalizeHeader);
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      let empty = true;
      headers.forEach((h, idx) => {
        const val = rows[r][idx] != null ? String(rows[r][idx]).trim() : "";
        obj[h] = val;
        if (val) empty = false;
      });
      if (!empty) out.push(obj);
    }
    return out;
  }

  async function fetchWithTimeout(url, options, ms) {
    const timeoutMs = ms || 8000;
    const ctrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => {
      try {
        ctrl && ctrl.abort();
      } catch (_) {
        /* ignore */
      }
    }, timeoutMs);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        mode: "cors",
        signal: ctrl ? ctrl.signal : undefined,
        ...options,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchText(url) {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return res.text();
  }

  async function fetchJson(url) {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return res.json();
  }

  function exportCsvUrl(spreadsheetId, gid) {
    if (!spreadsheetId) return "";
    if (gid == null || gid === "") {
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    }
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  }

  function gvizCsvUrl(spreadsheetId, sheetName, gid) {
    if (!spreadsheetId) return "";
    const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
    if (sheetName) return `${base}&sheet=${encodeURIComponent(sheetName)}`;
    if (gid != null && gid !== "") return `${base}&gid=${gid}`;
    return base;
  }

  function looksLikeHtml(text) {
    const t = String(text || "").trim().slice(0, 200).toLowerCase();
    return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("accounts.google.com");
  }

  function sheetsApiUrl(spreadsheetId, sheetName, apiKey) {
    const range = encodeURIComponent(`${sheetName}!A:Z`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${encodeURIComponent(
      apiKey
    )}`;
  }

  function valuesToObjects(values) {
    if (!values || !values.length) return [];
    const headers = values[0].map(normalizeHeader);
    const out = [];
    for (let r = 1; r < values.length; r++) {
      const obj = {};
      let empty = true;
      headers.forEach((h, idx) => {
        const val =
          values[r][idx] != null ? String(values[r][idx]).trim() : "";
        obj[h] = val;
        if (val) empty = false;
      });
      if (!empty) out.push(obj);
    }
    return out;
  }

  async function tryCsvText(url, label, source, requireRows) {
    const text = await fetchText(url);
    if (looksLikeHtml(text)) {
      throw new Error(
        `${label}: Google returned a login page (sheet is private). Share as "Anyone with the link → Viewer" or use an API key.`
      );
    }
    if (!String(text || "").trim()) {
      throw new Error(`${label}: empty response from ${source}`);
    }
    const rows = parseCsv(text);
    // Products must have data rows; empty CSV is a failed load (try next source)
    if (requireRows && !rows.length) {
      throw new Error(`${label}: no data rows from ${source}`);
    }
    return { rows, source, label };
  }

  function normalizeProductList(list) {
    return (list || [])
      .filter((p) => p && p.active !== false)
      .map((p) => ({
        sku: String(p.sku || "").trim(),
        qboItemId: String(p.qboItemId || p.sku || "").trim(),
        name: String(p.name || "").trim(),
        description: String(p.description || "").trim(),
        category: String(p.category || "General").trim() || "General",
        unit: String(p.unit || "ea").trim() || "ea",
        price: Number(p.price) || 0,
        staffPick: Boolean(p.staffPick),
        active: true,
        notes: String(p.notes || "").trim(),
      }))
      .filter((p) => p.name || p.sku);
  }

  async function loadJsonProducts(url) {
    const data = await fetchJson(url);
    if (!Array.isArray(data)) {
      throw new Error("Product JSON is not an array");
    }
    // Already shaped ({ name, sku, ... }) or raw sheet-like rows
    if (data.length && data[0] && data[0].name != null) {
      return normalizeProductList(data);
    }
    return normalizeProductList(
      data.map((row, i) => {
        const n = {};
        Object.keys(row || {}).forEach((k) => {
          n[normalizeHeader(k)] = row[k] == null ? "" : String(row[k]);
        });
        return mapProduct(n, i);
      }).filter(Boolean)
    );
  }

  async function loadSheetRows(options) {
    const {
      csvUrl,
      spreadsheetId,
      gid,
      sheetName,
      apiKey,
      fallbackUrl,
      label,
      requireRows,
    } = options;

    const errors = [];
    const needRows = Boolean(requireRows);

    // 1) Explicit CSV URL (published sheet or Apps Script export)
    if (csvUrl) {
      try {
        return await tryCsvText(csvUrl, label, "csv-url", needRows);
      } catch (err) {
        console.warn(`[DisFruta] ${label} CSV URL failed:`, err);
        errors.push(err.message || String(err));
      }
    }

    // 2) Sheets API v4
    if (spreadsheetId && apiKey && sheetName) {
      try {
        const data = await fetchJson(
          sheetsApiUrl(spreadsheetId, sheetName, apiKey)
        );
        const rows = valuesToObjects(data.values || []);
        if (needRows && !rows.length) {
          throw new Error("Sheets API returned no rows");
        }
        return { rows, source: "sheets-api", label };
      } catch (err) {
        console.warn(`[DisFruta] ${label} Sheets API failed:`, err);
        errors.push(err.message || String(err));
      }
    }

    // 3) Public spreadsheet export by id + gid
    if (spreadsheetId && gid != null && gid !== "") {
      try {
        return await tryCsvText(
          exportCsvUrl(spreadsheetId, gid),
          label,
          "export-csv",
          needRows
        );
      } catch (err) {
        console.warn(`[DisFruta] ${label} export CSV failed:`, err);
        errors.push(err.message || String(err));
      }
    }

    // 4) gviz CSV by sheet name (works for link-shared sheets)
    if (spreadsheetId && sheetName) {
      try {
        return await tryCsvText(
          gvizCsvUrl(spreadsheetId, sheetName),
          label,
          "gviz-sheet",
          needRows
        );
      } catch (err) {
        console.warn(`[DisFruta] ${label} gviz sheet failed:`, err);
        errors.push(err.message || String(err));
      }
    }

    // 5) gviz by gid only
    if (spreadsheetId && gid != null && gid !== "") {
      try {
        return await tryCsvText(
          gvizCsvUrl(spreadsheetId, "", gid),
          label,
          "gviz-gid",
          needRows
        );
      } catch (err) {
        console.warn(`[DisFruta] ${label} gviz gid failed:`, err);
        errors.push(err.message || String(err));
      }
    }

    // 6) Local / remote JSON fallback
    if (fallbackUrl) {
      try {
        const data = await fetchJson(fallbackUrl);
        if (Array.isArray(data)) {
          if (data.length && data[0] && data[0].name != null) {
            return { rows: null, products: data, source: "json", label };
          }
          const rows = data.map((obj) => {
            const n = {};
            Object.keys(obj).forEach((k) => {
              n[normalizeHeader(k)] = obj[k] == null ? "" : String(obj[k]);
            });
            return n;
          });
          if (needRows && !rows.length) {
            throw new Error("JSON fallback empty");
          }
          return { rows, source: "json-rows", label };
        }
      } catch (err) {
        errors.push(err.message || String(err));
      }
    }

    // Empty sheet is OK for Clients / Previous (headers only)
    if (!needRows && spreadsheetId && (gid != null && gid !== "" || sheetName)) {
      return { rows: [], source: "empty-sheet", label };
    }

    throw new Error(
      `Could not load ${label}. ${
        errors[0] || "Configure Google Sheets in js/config.js"
      } (see integrations/googlesheets/README.md).`
    );
  }

  function mapProduct(row, index) {
    const name = pick(row, "name");
    if (!name) return null;
    const sku = pick(row, "sku") || `ROW-${index + 1}`;
    const qboItemId = pick(row, "qboItemId") || sku;
    const activeRaw = pick(row, "active");
    const active = activeRaw === "" ? true : truthy(activeRaw);
    return {
      sku: String(sku),
      qboItemId: String(qboItemId),
      name: String(name),
      description: String(pick(row, "description") || ""),
      category: String(pick(row, "category") || "General"),
      price: numberish(pick(row, "price")),
      unit: String(pick(row, "unit") || "ea"),
      active,
      staffPick: truthy(pick(row, "staffPick")),
      notes: String(pick(row, "notes") || ""),
    };
  }

  function mapClient(row) {
    const qboCustomerId = pick(row, "qboCustomerId");
    const name = pick(row, "customerName") || pick(row, "name");
    if (!qboCustomerId && !name) return null;
    const activeRaw = pick(row, "active");
    return {
      qboCustomerId: String(qboCustomerId || ""),
      name: String(name || `Customer ${qboCustomerId}`),
      phone: String(pick(row, "phone") || ""),
      email: String(pick(row, "email") || ""),
      frequency: String(pick(row, "frequency") || ""),
      dayOfWeek: String(pick(row, "dayOfWeek") || ""),
      lastOrderDate: String(pick(row, "lastOrderDate") || ""),
      nextDeliveryDate: String(pick(row, "nextDeliveryDate") || ""),
      active: activeRaw === "" ? true : truthy(activeRaw),
      notes: String(pick(row, "notes") || ""),
      previousOrder: [],
    };
  }

  function mapPreviousLine(row) {
    const qboCustomerId = String(pick(row, "qboCustomerId") || "");
    const sku = pick(row, "sku");
    // Prefer explicit product columns so "Name" does not steal Customer Name
    const product =
      row[normalizeHeader("product name")] ||
      row[normalizeHeader("item name")] ||
      row[normalizeHeader("product")] ||
      row[normalizeHeader("item")] ||
      "";
    const customerName = String(
      row[normalizeHeader("customer name")] ||
        row[normalizeHeader("client name")] ||
        row[normalizeHeader("customer")] ||
        row[normalizeHeader("client")] ||
        ""
    );

    if (!qboCustomerId && !sku && !product) return null;
    const activeRaw = pick(row, "active");
    return {
      qboCustomerId,
      customerName,
      sku: String(sku || ""),
      productName: String(product || ""),
      quantity: numberish(pick(row, "defaultQuantity")) || 1,
      unit: String(pick(row, "unit") || "ea"),
      frequency: String(pick(row, "frequency") || ""),
      dayOfWeek: String(pick(row, "dayOfWeek") || ""),
      active: activeRaw === "" ? true : truthy(activeRaw),
      lastOrderDate: String(pick(row, "lastOrderDate") || ""),
      notes: String(pick(row, "notes") || ""),
    };
  }

  function attachPreviousOrders(clients, previousLines, productsBySku, productsByName) {
    const byCustomer = new Map();
    previousLines.forEach((line) => {
      if (!line || line.active === false) return;
      const id = String(line.qboCustomerId || "");
      if (!id) return;
      if (!byCustomer.has(id)) byCustomer.set(id, []);
      byCustomer.get(id).push(line);
    });

    return clients.map((c) => {
      const lines = byCustomer.get(String(c.qboCustomerId)) || [];
      const previousOrder = lines
        .map((line) => {
          let sku = line.sku;
          if (!sku && line.productName) {
            const p = productsByName.get(normalizeHeader(line.productName));
            if (p) sku = p.sku;
          }
          if (!sku) return null;
          // prefer catalog unit/price if present
          const catalog = productsBySku.get(sku);
          return {
            sku,
            quantity: line.quantity > 0 ? line.quantity : 1,
            unit: line.unit || catalog?.unit || "ea",
            productName: line.productName || catalog?.name || "",
          };
        })
        .filter(Boolean);

      // enrich next delivery from day of week if missing (left for Make.com URL)
      return {
        ...c,
        previousOrder,
        // bubble frequency/day from previous lines if client row blank
        frequency: c.frequency || lines[0]?.frequency || "",
        dayOfWeek: c.dayOfWeek || lines[0]?.dayOfWeek || "",
      };
    });
  }

  /**
   * Resolve a catalog URL relative to the page, with a few common fallbacks.
   */
  function candidateUrls(pathOrUrl) {
    const raw = pathOrUrl || "./data/products.json";
    if (/^https?:\/\//i.test(raw)) return [raw];
    const cleaned = raw.replace(/^\.\//, "");
    const urls = [];
    try {
      urls.push(new URL(raw, window.location.href).href);
    } catch (_) {
      /* ignore */
    }
    // If page is in /webform/ or similar
    try {
      urls.push(new URL(cleaned, window.location.href).href);
    } catch (_) {
      /* ignore */
    }
    // Absolute from origin root variants
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      urls.push(`${window.location.origin}/${cleaned}`);
      urls.push(`${window.location.origin}/webform/${cleaned}`);
      urls.push(`${window.location.origin}/webform/data/products.json`);
      urls.push(`${window.location.origin}/data/products.json`);
    }
    // relative fallbacks
    urls.push(`./${cleaned}`);
    urls.push(`/${cleaned}`);
    urls.push("./data/products.json");
    urls.push("../data/products.json");
    return [...new Set(urls)];
  }

  async function loadJsonProductsFromCandidates(pathOrUrl) {
    const errors = [];
    for (const url of candidateUrls(pathOrUrl)) {
      try {
        const list = await loadJsonProducts(url);
        if (list.length) return { products: list, url };
      } catch (err) {
        errors.push(`${url}: ${err.message || err}`);
      }
    }
    throw new Error(errors[0] || "Could not fetch products.json");
  }

  /**
   * Load products + customers (+ previous orders) per config.
   *
   * Products strategy (bulletproof):
   *  1. Embedded window.DISFRUTA_PRODUCTS (js/products-data.js) — no fetch needed
   *  2. Fetch products.json from several relative/absolute paths
   *  3. Optional Google Sheets upgrade when CORS allows
   *
   * @param {object} cfg window.DISFRUTA_CONFIG
   */
  async function loadCatalog(cfg) {
    const sheets = cfg.googleSheets || {};
    const enabled = sheets.enabled !== false;
    const spreadsheetId = sheets.spreadsheetId || "";
    const apiKey = sheets.apiKey || "";
    const localProductsUrl = cfg.productsUrl || "./data/products.json";

    const sources = { products: null, clients: null, previous: null };

    // --- Products ---
    let products = [];

    // 1) Embedded catalog (works on file:// and any static host)
    if (
      typeof window !== "undefined" &&
      Array.isArray(window.DISFRUTA_PRODUCTS) &&
      window.DISFRUTA_PRODUCTS.length
    ) {
      products = normalizeProductList(window.DISFRUTA_PRODUCTS);
      sources.products = "embedded";
      console.info(
        `[DisFruta] Loaded ${products.length} products from embedded products-data.js`
      );
    }

    // 2) Fetch products.json if embedded missing/empty
    if (!products.length) {
      try {
        const loaded = await loadJsonProductsFromCandidates(localProductsUrl);
        products = loaded.products;
        sources.products = "json";
        console.info(
          `[DisFruta] Loaded ${products.length} products from ${loaded.url}`
        );
      } catch (err) {
        console.warn("[DisFruta] products.json fetch failed:", err);
        products = [];
      }
    }

    // 3) Upgrade from Google Sheets when available (may fail in browser CORS)
    if (enabled && spreadsheetId) {
      try {
        const result = await loadSheetRows({
          csvUrl: sheets.productsCsvUrl || "",
          spreadsheetId,
          gid: sheets.productsGid,
          sheetName: sheets.productsSheet || "Products",
          apiKey,
          fallbackUrl: "", // already have local/embedded
          label: "Products",
          requireRows: true,
        });
        let live = [];
        if (result.products) {
          live = normalizeProductList(result.products);
        } else {
          live = normalizeProductList(
            (result.rows || [])
              .map((row, i) => mapProduct(row, i))
              .filter(Boolean)
          );
        }
        if (live.length > 0) {
          products = live;
          sources.products = result.source || "sheets";
          console.info(
            `[DisFruta] Using live sheet products (${live.length}) via ${sources.products}`
          );
        }
      } catch (err) {
        console.warn(
          "[DisFruta] Live sheet products unavailable (using local/embedded catalog):",
          err.message || err
        );
      }
    }

    if (!products.length) {
      throw new Error(
        "No products loaded. Include js/products-data.js, or serve webform/ over HTTP so data/products.json can load."
      );
    }

    const productsBySku = new Map(products.map((p) => [String(p.sku), p]));
    const productsByName = new Map(
      products.map((p) => [String(p.name).trim().toLowerCase(), p])
    );
    console.info(
      `[DisFruta] Products ready: ${products.length} active`,
      "source:",
      sources.products,
      "categories:",
      [...new Set(products.map((p) => p.category))].sort()
    );

    // --- Clients ---
    let clients = [];

    function useEmbeddedOrLocalClients(reason) {
      if (
        typeof window !== "undefined" &&
        Array.isArray(window.DISFRUTA_CUSTOMERS) &&
        window.DISFRUTA_CUSTOMERS.length
      ) {
        sources.clients = reason || "embedded";
        return window.DISFRUTA_CUSTOMERS.slice();
      }
      return null;
    }

    if (enabled && spreadsheetId) {
      try {
        const result = await loadSheetRows({
          csvUrl: sheets.clientsCsvUrl || "",
          spreadsheetId,
          gid: sheets.clientsGid,
          sheetName: sheets.clientsSheet || "Clients",
          apiKey,
          fallbackUrl: "",
          label: "Clients",
          requireRows: false,
        });
        sources.clients = result.source;
        if (result.products) {
          clients = result.products;
        } else {
          clients = (result.rows || []).map(mapClient).filter(Boolean);
        }
      } catch (err) {
        console.warn("[DisFruta] Clients sheet load failed:", err);
        clients = [];
      }
    }

    // Header-only / failed Clients → embedded demo or JSON
    if (!clients.length) {
      const embedded = useEmbeddedOrLocalClients("embedded");
      if (embedded) {
        clients = embedded;
      } else if (cfg.customersUrl) {
        try {
          for (const url of candidateUrls(cfg.customersUrl)) {
            try {
              const demo = await fetchJson(url);
              if (Array.isArray(demo) && demo.length) {
                clients = demo;
                sources.clients = "json";
                break;
              }
            } catch (_) {
              /* try next */
            }
          }
        } catch (_) {
          /* ignore */
        }
      }
    }

    // If JSON customers already include previousOrder, keep them
    const alreadyHavePrevious = (clients || []).some(
      (c) => Array.isArray(c.previousOrder) && c.previousOrder.length
    );

    // --- Previous orders ---
    let previousLines = [];
    if (enabled && !alreadyHavePrevious) {
      try {
        const hasPreviousConfig =
          sheets.previousCsvUrl ||
          sheets.previousGid != null ||
          (spreadsheetId && apiKey);
        if (hasPreviousConfig || spreadsheetId) {
          const result = await loadSheetRows({
            csvUrl: sheets.previousCsvUrl || "",
            spreadsheetId,
            gid: sheets.previousGid,
            sheetName: sheets.previousSheet || "Previous",
            apiKey,
            fallbackUrl: "",
            label: "Previous",
          });
          sources.previous = result.source;
          previousLines = (result.rows || [])
            .map(mapPreviousLine)
            .filter(Boolean);
        }
      } catch (err) {
        console.warn(
          "[DisFruta] Previous sheet not loaded (optional):",
          err.message || err
        );
        sources.previous = "skipped";
      }
    }

    if (previousLines.length) {
      clients = attachPreviousOrders(
        clients.map((c) =>
          // normalize client shape if from JSON
          c.qboCustomerId != null
            ? {
                qboCustomerId: String(c.qboCustomerId),
                name: c.name || c.customerName || "",
                phone: c.phone || "",
                email: c.email || "",
                frequency: c.frequency || "",
                dayOfWeek: c.dayOfWeek || "",
                lastOrderDate: c.lastOrderDate || "",
                nextDeliveryDate: c.nextDeliveryDate || "",
                active: c.active !== false,
                notes: c.notes || "",
                previousOrder: c.previousOrder || [],
              }
            : c
        ),
        previousLines,
        productsBySku,
        productsByName
      );
    } else {
      // ensure consistent shape
      clients = (clients || []).map((c) => ({
        qboCustomerId: String(c.qboCustomerId || c.id || ""),
        name: c.name || c.customerName || "",
        phone: c.phone || "",
        email: c.email || "",
        frequency: c.frequency || "",
        dayOfWeek: c.dayOfWeek || "",
        lastOrderDate: c.lastOrderDate || "",
        nextDeliveryDate: c.nextDeliveryDate || "",
        active: c.active !== false,
        notes: c.notes || "",
        previousOrder: c.previousOrder || [],
      }));
    }

    clients = clients.filter((c) => c.active !== false);

    return {
      products,
      customers: clients,
      sources,
      meta: {
        productCount: products.length,
        customerCount: clients.length,
        previousLineCount: previousLines.length,
      },
    };
  }

  global.DisfrutaSheets = {
    loadCatalog,
    parseCsv,
    mapProduct,
    mapClient,
    normalizeHeader,
  };
})(window);
