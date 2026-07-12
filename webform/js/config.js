/**
 * DisFruta Order Form — runtime configuration
 *
 * Make.com is the automation hub (makeWebhookUrl). See make/order-processing.md.
 *
 * Personalization URL (Twilio / Make SMS):
 *   index.html?customerId=24&deliveryDate=2026-07-15&token=optional
 * New customer: index.html  or  index.html?new=1
 * Admin: admin.html
 *
 * Catalog: Google Sheets (config.googleSheets) + embedded js/products-data.js fallback.
 * Sheet setup: integrations/googlesheets/README.md
 */
window.DISFRUTA_CONFIG = {
  /**
   * Make.com is the brains — form submits here first.
   * Scenario: Webhook → Google Sheets → QuickBooks Online invoice → Twilio.
   * Create a Custom Webhook module and paste the URL below.
   * See make/order-processing.md
   */
  makeWebhookUrl: "",

  /**
   * Optional direct Order API (only if Make is not used for a given env).
   * Prefer Make.com calling QBO (or Make HTTP → this API) instead of the
   * browser posting here. Leave empty when Make is the hub.
   */
  orderApiUrl: "",

  // Shared secret: send as X-Disfruta-Secret (Make filter and/or Order API)
  webhookSecret: "",

  // Demo mode when makeWebhookUrl (and orderApiUrl) are empty
  demoMode: true,

  /**
   * Google Sheets — primary source for catalog data
   *
   * Option A (recommended for production): Sheets API
   *   1. Create a Google Cloud API key with Sheets API enabled
   *   2. Share the spreadsheet as "Anyone with the link: Viewer"
   *   3. Fill spreadsheetId + apiKey + sheet names
   *
   * Option B: Published CSV URLs (File → Share → Publish to web)
   *   Paste each tab's published CSV link into *CsvUrl fields
   *
   * Option C: Public spreadsheet + gid (Share → Anyone with link)
   *   Fill spreadsheetId + productsGid / clientsGid / previousGid
   *
   * If Sheets is unreachable, the form falls back to local JSON below.
   */
  googleSheets: {
    enabled: true,

    // DisFruta Order System spreadsheet (Anyone with the link → Viewer)
    // https://docs.google.com/spreadsheets/d/1smT7aeA63aAQwggMQON1sjh1N3G7XBLNdPaKI82EnSA/edit
    //
    // Tabs: Products | Previous | Clients | Notes | Delivery Reports
    spreadsheetId: "1smT7aeA63aAQwggMQON1sjh1N3G7XBLNdPaKI82EnSA",

    // Optional — Google Cloud API key (Sheets API enabled)
    apiKey: "",

    // Tab names (API / gviz)
    productsSheet: "Products",
    clientsSheet: "Clients",
    previousSheet: "Previous",

    // Tab gids from sheet URLs (#gid=…)
    productsGid: "0",
    previousGid: "457485810",
    clientsGid: "817083110",
    // Notes: 344020767 · Delivery Reports: 1710529538 (written by Make.com)

    // Published CSV overrides (optional)
    productsCsvUrl: "",
    clientsCsvUrl: "",
    previousCsvUrl: "",
  },

  // Local JSON fallbacks (demo / offline)
  productsUrl: "./data/products.json",
  customersUrl: "./data/customers.json",

  // Promo section title (Staff Picks / Promotional / Last Chance)
  promoTitle: "Staff Picks",
  promoTag: "This week",

  /**
   * Category chip order on the form.
   * - Frozen Fruit Pulps* first (14 → 32 → 64 Oz)
   * - Then other categories alphabetically
   * - Dry Food always last
   * Any category in the catalog that is not listed is still shown
   * (inserted before Dry Food).
   */
  categoryOrder: [
    "Frozen Fruit Pulps 14 Oz",
    "Frozen Fruit Pulps 32 Oz",
    "Frozen Fruit Pulps 64 Oz",
    "Frozen Food",
    "Soda/Drinks",
    "Dry Food",
  ],

  // Business rules
  cutoffHour: 17, // 5:00 PM local time day before delivery
  businessName: "DisFruta",
  currency: "USD",
  locale: "en-US",

  // Public form: allow first-time customers without a personalized link
  allowNewCustomers: true,
  // Returning customers can look up by phone (Clients sheet) when no SMS link
  allowPhoneLookup: true,

  // Submitted payload version for Make.com routers
  payloadVersion: "1.1",
};
