/**
 * DisFruta Order Form — EN / ES internationalization
 *
 * Usage:
 *   DisfrutaI18n.t("key")
 *   DisfrutaI18n.t("key", { name: "Ada" })
 *   DisfrutaI18n.tn(n, "one_key", "many_key", { n })
 *
 * Preferred language is per customer (Clients sheet + SMS ?lang=).
 * Returning customers: served only their preferred language (no header toggle).
 * New customers: choose language once on the contact form.
 *
 * Header EN|ES toggle is commented out in HTML (kept for future debugging).
 * setLang(lang, { source: "customer"|"url"|"new-user"|"manual" })
 */
(function () {
  "use strict";

  const STORAGE_KEY = "disfruta_lang";

  /** @type {Record<string, Record<string, string>>} */
  const STRINGS = {
    en: {
      // Meta
      "meta.title": "DisFruta — Your Weekly Order",
      "meta.description": "Review and modify your DisFruta recurring order.",
      "meta.title_admin": "DisFruta — Admin Order Entry",

      // Header / chrome
      "header.badge_weekly": "Weekly order",
      "header.badge_biweekly": "Every 2 weeks",
      "header.badge_3weeks": "Every 3 weeks",
      "header.badge_monthly": "Monthly order",
      "header.badge_twice": "Twice weekly",
      "header.badge_other": "Custom schedule",
      "header.badge_new": "New customer",
      "header.badge_admin": "Admin",
      "header.lang_label": "Language",
      "header.customer_view": "Customer view",
      "header.logo_home": "DisFruta home — back to start",
      "admin.banner": "ADMIN · Order on behalf of customer",
      "admin.gate_title": "Admin sign-in",
      "admin.gate_body":
        "Owners only. Sign in with your DisFruta username and password, then confirm a customer’s phone number to place an order on their behalf.",
      "admin.username": "Username",
      "admin.password": "Password",
      "admin.sign_in": "Sign in",
      "admin.logout": "Sign out",
      "admin.login_error": "Invalid username or password.",
      "admin.customer_phone": "Customer phone on file",
      "admin.customer_phone_help":
        "Enter the phone number from the Clients sheet to unlock this account.",
      "admin.unlock_customer": "Unlock customer",
      "admin.phone_error": "That phone number does not match this customer.",
      "admin.phone_missing":
        "This customer has no phone on file. Add one in Clients, or unlock is blocked.",
      "admin.phone_ok": "Customer unlocked.",
      "admin.signed_in_as": "Signed in as {name}",
      "unlock.heading": "Confirm it’s you",
      "unlock.sub_phone":
        "Enter the phone number on your DisFruta account to open this order.",
      "unlock.sub_pin":
        "Enter the phone number and order PIN on your account to continue.",
      "unlock.sub_pin_only": "Enter your order PIN to continue.",
      "unlock.phone_label": "Phone on file",
      "unlock.pin_label": "Order PIN",
      "unlock.pin_ph": "••••",
      "unlock.submit": "Unlock my order",
      "unlock.error_phone": "That phone number doesn’t match our records.",
      "unlock.error_pin": "That PIN is incorrect.",
      "unlock.error_generic": "Could not unlock this order. Try again.",

      // Loading
      "loading.title": "Loading your order…",
      "loading.body": "Loading products and customer options.",
      "loading.title_admin": "Loading catalog…",
      "loading.body_admin": "Customers and products from your order system.",

      // Landing
      "landing.title": "Order with DisFruta",
      "landing.body":
        "Place a new wholesale order, or reopen your usual order with a personalized link or phone lookup.",
      "landing.new_btn": "I’m a new customer",
      "landing.returning_btn": "I already order with DisFruta",
      "landing.switch_hint": "You can switch later if you pick the wrong option.",
      "landing.find_title": "Find your account",
      "landing.find_body":
        "Use the link from your text message, or look up with the phone number on file.",
      "landing.phone_label": "Phone number",
      "landing.phone_placeholder": "(555) 123-4567",
      "landing.lookup_btn": "Find my previous order",
      "landing.sms_hint":
        "Prefer SMS? Open the personalized link we sent you — it loads your account automatically.",
      "landing.admin_link": "Admin order entry",

      // Error / success
      "error.title": "We couldn’t submit that",
      "error.body": "Something went wrong. Please try again.",
      "error.tip":
        "Tip: open the form via a local server, e.g. cd webform && python3 -m http.server 8080 — not as a raw file:// page.",
      "error.retry": "Try again",
      "error.title_admin": "Submission failed",
      "error.body_admin": "Something went wrong.",
      "success.title": "Order received",
      "success.body":
        "Thank you! Your order is in. You’ll get a confirmation text shortly.",
      "success.title_admin": "Order submitted",
      "success.body_admin":
        "Order was sent to Make.com for QuickBooks draft invoice creation.",
      "success.another": "Enter another order",

      // Hero
      "hero.kicker_hello": "Hello",
      "hero.kicker_welcome": "Welcome",
      "hero.kicker_ordering": "Ordering for",
      "hero.subtitle": "What would you like this week?",
      "hero.subtitle_new": "Build your order — Search or Browse products below.",
      "hero.delivery_prefix": "Next delivery:",
      "hero.switch_returning": "Already a customer? Find your account",
      "hero.switch_landing": "← Back to start",
      "toast.home": "Choose new or existing customer",
      "hero.select_customer": "Select a customer",
      "hero.customer_fallback": "Customer",
      "hero.new_customer": "New customer",
      "hero.tbd": "TBD",

      // Contact (new customer)
      "contact.heading": "Your business details",
      "contact.sub":
        "We’ll use this to set up your account and confirm the order.<br />If you already order with DisFruta, use the link above to look up your account instead.<br /><br /><span class=\"section-sub-note\">Fields marked * are required</span>",
      "contact.name": "Business / customer name *",
      "contact.name_ph": "e.g. Mercado Latino Fresh",
      "contact.phone": "Phone *",
      "contact.email": "Email",
      "contact.email_ph": "orders@business.com",
      "contact.day": "Preferred delivery day",
      "contact.day_select": "— Select —",
      "contact.day_mon": "Monday",
      "contact.day_tue": "Tuesday",
      "contact.day_wed": "Wednesday",
      "contact.day_thu": "Thursday",
      "contact.day_fri": "Friday",
      "contact.day_sat": "Saturday",
      "contact.frequency": "Order frequency",
      "contact.freq_select": "— Select —",
      "contact.freq_weekly": "Weekly",
      "contact.freq_biweekly": "Every 2 weeks",
      "contact.freq_3weeks": "Every 3 weeks",
      "contact.freq_monthly": "Monthly",
      "contact.freq_twice": "Twice weekly",
      "contact.freq_other": "Other",
      "contact.freq_other_label": "Describe your frequency *",
      "contact.freq_other_ph": "e.g. Every other Thursday, skip holiday weeks",
      "contact.freq_other_hint":
        "Tell us how often you want deliveries so we can set up the right schedule.",
      "contact.language": "Preferred language",
      "contact.lang_en": "English",
      "contact.lang_es": "Español",
      "contact.address": "Delivery address",
      "contact.address_ph": "Street, city, state, ZIP",

      // Notices
      "notice.cutoff":
        "Orders must be submitted by <span class=\"notice-time\">5:00 PM</span> the day before delivery",
      "notice.cutoff_on":
        "Orders must be submitted by <span class=\"notice-time\">5:00 PM</span> on {day} (the day before delivery)",
      "notice.cutoff_before":
        "Orders must be submitted by <span class=\"notice-time\">5:00 PM</span> the day before delivery",
      "notice.new_review":
        "New accounts are reviewed by DisFruta before the first delivery",
      "notice.day_before": "the day before delivery",

      // Contacts / duplicate order
      "order_contact.heading": "Who is placing this order?",
      "order_contact.sub":
        "More than one person is listed for this account. Choose who is ordering today.",
      "order_contact.label": "Contact",
      "order_contact.primary": "primary",
      "order_contact.unnamed": "Contact",
      "order_contact.as": "Ordering as {name}",
      "already.heading": "Order already submitted",
      "already.body":
        "An order is already in for {date}. The first submission wins — additional orders from this account are not accepted.",
      "already.body_declined":
        "This delivery period was already skipped for {date}.",
      "already.help": "If you need to change it, contact DisFruta.",
      "already.toast": "An order is already in for this delivery",

      // Decline
      "decline.heading": "Don’t need a delivery this period?",
      "decline.body":
        "Skip this cycle entirely — no invoice, and we stop reminders until your next delivery window.",
      "decline.btn": "No order this period",
      "decline.btn_footer": "No order needed this period",
      "decline.btn_bar": "Skip period",
      "decline.heading_admin": "Customer skipping this period?",
      "decline.body_admin":
        "Record no delivery for this cycle — no invoice and stop reminders.",
      "decline.btn_admin": "Decline period (no order)",
      "decline.confirm":
        "Skip the entire order period for {name}?\n\nDelivery: {period}\n\n• No invoice will be created\n• Reminders stop for this period\n• You can still order again next cycle",
      "decline.period_fallback": "this delivery period",

      // Cart
      "cart.heading": "Your Order",
      "cart.heading_previous": "Your Previous Order",
      "cart.sub_new": "Add items from the catalog below.",
      "cart.sub_new_picks": "Add items from Staff Picks or the catalog below.",
      "cart.sub_returning":
        "Adjust quantities or remove items. Your last order is pre-filled.",
      "cart.empty_new": "Your cart is empty",
      "cart.empty_returning": "No items yet",
      "cart.empty_new_hint": "Browse products to start your order.",
      "cart.empty_new_hint_picks":
        "Browse products or tap a Staff Pick to start your order.",
      "cart.empty_returning_hint":
        "Your previous order will appear here when available. Add products below.",
      "cart.remove": "Remove",
      "cart.qty_for": "Quantity for {name}",
      "cart.decrease": "Decrease",
      "cart.increase": "Increase",
      "cart.quantity": "Quantity",
      "cart.items_one": "{n} item",
      "cart.items_many": "{n} items",

      // Promo
      "promo.title": "Staff Picks",
      "promo.sub": "One-tap adds for this week’s recommended items.",
      "promo.tag": "This week",
      "promo.add": "Add",
      "promo.add_more": "Add more",

      // Browse
      "browse.heading": "Add More Items",
      "browse.sub":
        "Search the <strong>full catalog</strong> anytime (all categories), or pick a category chip to browse that group. Use <strong>Add all</strong> to put every item in a category on your order.",
      "browse.sub_preferred":
        "Showing <strong>your usual categories</strong>. Search or pick a chip below. Need something else?",
      "browse.search_label": "Search all products",
      "browse.search_label_preferred": "Search your usual items",
      "browse.search_ph": "Search all products by name, SKU…",
      "browse.search_ph_preferred": "Search your usual items…",
      "browse.scope_hint":
        "Searching <strong>all products</strong> — category filter is paused while you type.",
      "browse.scope_hint_preferred":
        "Searching <strong>your usual categories</strong> — tap Add other items to search everything.",
      "browse.add_other": "Add other items",
      "browse.preferred_only": "Show preferred only",
      "browse.scope_preferred": "Your usual categories.",
      "browse.scope_all": "Showing the full catalog.",
      "browse.matches_pref_one": "{n} match (your categories)",
      "browse.matches_pref_many": "{n} matches (your categories)",
      "browse.empty_tip_preferred":
        "Tip: tap <strong>Add other items</strong> to see the rest of the catalog.",
      "browse.add_all": "Add all in category",
      "browse.products_one": "{n} product",
      "browse.products_many": "{n} products",
      "browse.in_category": "{n} in category",
      "browse.matches_one": "{n} match (all products)",
      "browse.matches_many": "{n} matches (all products)",
      "browse.toolbar_one": "{n} product in {category}",
      "browse.toolbar_many": "{n} products in {category}",
      "browse.empty_loaded": "No products loaded",
      "browse.empty_loaded_body":
        "Check that the Google Sheet is shared as “Anyone with the link → Viewer”, then refresh. Fallback catalog may also be missing.",
      "browse.empty_match": "No products match",
      "browse.empty_search":
        "Nothing matched “{q}”. Try fewer words or another spelling.",
      "browse.empty_category": "No active products in “{category}”.",
      "browse.empty_tip":
        "Tip: choose <strong>All</strong> or clear the search box to browse everything.",
      "browse.in_order": "In order: {n}",
      "browse.qty_add": "Qty to add",
      "browse.add": "Add",
      "browse.chip_title": "{category} — {n} products",
      "browse.chip_aria": "{category}, {n} products",
      "browse.product_fallback": "Product",
      "cat.all": "All",
      "cat.pulps_short": "Fruit Pulps {size}",

      // Notes
      "notes.heading": "Special notes",
      "notes.sub":
        "Delivery instructions, substitutions, samples, or anything else we should know.",
      "notes.label": "Order notes",
      "notes.ph": "e.g. Leave at back door · Need sample of arepas",
      "notes.ph_admin": "Notes from customer text / phone call",

      // Summary
      "summary.label": "Order summary",
      "summary.total": "Total",
      "summary.submit": "Submit Order",
      "summary.submit_first": "Submit first order",
      "summary.submitting": "Submitting…",

      // Admin
      "admin.select_label": "Customer (QuickBooks Online ID → Name)",
      "admin.select_placeholder": "— Choose customer —",
      "admin.help":
        "Selecting a customer loads their header and previous order so you can order on their behalf (e.g. when they text instead of using the form).",

      // Toasts / hints
      "toast.lookup_account": "Look up your account with the phone on file",
      "toast.choose_path": "Choose new or existing customer",
      "toast.new_disabled": "New customer orders are not enabled",
      "toast.use_sms_link": "Use the personalized link from your text message",
      "toast.invalid_phone": "Enter a valid phone number.",
      "toast.no_account": "No account found for that number. ",
      "toast.no_account_new": "Start as a new customer",
      "toast.no_account_sms": "Use the link from your SMS, or contact DisFruta.",
      "toast.welcome_back": "Welcome back, {name}!",
      "toast.item_removed": "Item removed",
      "toast.added": "Added to order",
      "toast.missing_sku": "Could not add item (missing SKU)",
      "toast.not_in_catalog": "Product not in catalog",
      "toast.no_in_category": "No products in that category",
      "toast.all_already":
        "All products in this category are already on your order",
      "toast.added_from_cat_one": "Added {n} item from {category}",
      "toast.added_from_cat_many": "Added {n} items from {category}",
      "toast.select_customer": "Select a customer first",
      "toast.open_link_first": "Open your order link first",
      "toast.choose_first": "Choose new or returning customer first",
      "toast.need_contact": "Enter your business name and phone number",
      "toast.need_frequency_other": "Describe your order frequency",
      "toast.open_or_lookup":
        "Open your personalized link or look up your account",
      "toast.need_items":
        "Add at least one item — or skip this period if you need no delivery",
      "toast.open_to_skip": "Open your personalized link to skip this period",
      "toast.no_products": "No products loaded — check console",
      "confirm.add_all":
        "Add all {n} products in “{category}” to your order (qty 1 each)?",

      // Success details
      "success.declined":
        "No order for <strong>{when}</strong>. We won’t send more reminders for this delivery window, and no invoice will be created. See you next cycle!",
      "success.with_invoice":
        "Thanks, {name}! Your order totaling {total} was received — QuickBooks invoice <strong>#{doc}</strong>. You'll get a confirmation shortly.",
      "success.with_total":
        "Thanks, {name}! Your order totaling {total} was received. You'll get a confirmation text shortly.",
      "success.first_order":
        "Thanks, {name}! Your first order totaling {total} was received. Our team will confirm your account and delivery details shortly.",
      "success.name_fallback": "there",
      "success.when_period": "this period",
      "error.generic": "Something went wrong.",
      "error.load_failed":
        "Could not load order form. Serve via HTTP (python3 -m http.server) so products.json can load.",
    },

    es: {
      "meta.title": "DisFruta — Tu pedido semanal",
      "meta.description": "Revisa y modifica tu pedido recurrente de DisFruta.",
      "meta.title_admin": "DisFruta — Entrada de pedidos (admin)",

      "header.badge_weekly": "Pedido semanal",
      "header.badge_biweekly": "Cada 2 semanas",
      "header.badge_3weeks": "Cada 3 semanas",
      "header.badge_monthly": "Pedido mensual",
      "header.badge_twice": "Dos veces por semana",
      "header.badge_other": "Horario personalizado",
      "header.badge_new": "Cliente nuevo",
      "header.badge_admin": "Admin",
      "header.lang_label": "Idioma",
      "header.customer_view": "Vista del cliente",
      "header.logo_home": "Inicio DisFruta — volver al comienzo",
      "admin.banner": "ADMIN · Pedido en nombre del cliente",
      "admin.gate_title": "Acceso de administrador",
      "admin.gate_body":
        "Solo propietarios. Inicia sesión con tu usuario y contraseña de DisFruta; luego confirma el teléfono del cliente para pedir en su nombre.",
      "admin.username": "Usuario",
      "admin.password": "Contraseña",
      "admin.sign_in": "Iniciar sesión",
      "admin.logout": "Cerrar sesión",
      "admin.login_error": "Usuario o contraseña incorrectos.",
      "admin.customer_phone": "Teléfono del cliente registrado",
      "admin.customer_phone_help":
        "Ingresa el teléfono de la hoja Clients para desbloquear esta cuenta.",
      "admin.unlock_customer": "Desbloquear cliente",
      "admin.phone_error": "Ese teléfono no coincide con este cliente.",
      "admin.phone_missing":
        "Este cliente no tiene teléfono registrado. Agrégalo en Clients; el desbloqueo está bloqueado.",
      "admin.phone_ok": "Cliente desbloqueado.",
      "admin.signed_in_as": "Sesión: {name}",
      "unlock.heading": "Confirma que eres tú",
      "unlock.sub_phone":
        "Ingresa el teléfono de tu cuenta DisFruta para abrir este pedido.",
      "unlock.sub_pin":
        "Ingresa el teléfono y el PIN de pedido de tu cuenta para continuar.",
      "unlock.sub_pin_only": "Ingresa tu PIN de pedido para continuar.",
      "unlock.phone_label": "Teléfono registrado",
      "unlock.pin_label": "PIN de pedido",
      "unlock.pin_ph": "••••",
      "unlock.submit": "Desbloquear mi pedido",
      "unlock.error_phone": "Ese teléfono no coincide con nuestros registros.",
      "unlock.error_pin": "Ese PIN es incorrecto.",
      "unlock.error_generic": "No se pudo desbloquear el pedido. Inténtalo de nuevo.",

      "loading.title": "Cargando tu pedido…",
      "loading.body": "Cargando productos y opciones de cliente.",
      "loading.title_admin": "Cargando catálogo…",
      "loading.body_admin": "Clientes y productos de tu sistema de pedidos.",

      "landing.title": "Pide con DisFruta",
      "landing.body":
        "Haz un pedido mayorista nuevo, o reabre tu pedido habitual con un enlace personalizado o buscando por teléfono.",
      "landing.new_btn": "Soy cliente nuevo",
      "landing.returning_btn": "Ya pido con DisFruta",
      "landing.switch_hint":
        "Puedes cambiar después si eliges la opción incorrecta.",
      "landing.find_title": "Encuentra tu cuenta",
      "landing.find_body":
        "Usa el enlace de tu mensaje de texto, o busca con el teléfono registrado.",
      "landing.phone_label": "Número de teléfono",
      "landing.phone_placeholder": "(555) 123-4567",
      "landing.lookup_btn": "Buscar mi pedido anterior",
      "landing.sms_hint":
        "¿Prefieres SMS? Abre el enlace personalizado que te enviamos — carga tu cuenta automáticamente.",
      "landing.admin_link": "Entrada de pedidos (admin)",

      "error.title": "No pudimos enviar el pedido",
      "error.body": "Algo salió mal. Inténtalo de nuevo.",
      "error.tip":
        "Consejo: abre el formulario con un servidor local, p. ej. cd webform && python3 -m http.server 8080 — no como archivo file://.",
      "error.retry": "Intentar de nuevo",
      "error.title_admin": "Error al enviar",
      "error.body_admin": "Algo salió mal.",
      "success.title": "Pedido recibido",
      "success.body":
        "¡Gracias! Tu pedido está registrado. Recibirás un mensaje de confirmación en breve.",
      "success.title_admin": "Pedido enviado",
      "success.body_admin":
        "El pedido se envió a Make.com para crear la factura borrador en QuickBooks.",
      "success.another": "Ingresar otro pedido",

      "hero.kicker_hello": "Hola",
      "hero.kicker_welcome": "Bienvenido/a",
      "hero.kicker_ordering": "Pedido para",
      "hero.subtitle": "¿Qué te gustaría esta semana?",
      "hero.subtitle_new":
        "Arma tu pedido — Busca o explora productos abajo.",
      "hero.delivery_prefix": "Próxima entrega:",
      "hero.switch_returning": "¿Ya eres cliente? Busca tu cuenta",
      "hero.switch_landing": "← Volver al inicio",
      "toast.home": "Elige cliente nuevo o existente",
      "hero.select_customer": "Selecciona un cliente",
      "hero.customer_fallback": "Cliente",
      "hero.new_customer": "Cliente nuevo",
      "hero.tbd": "Por definir",

      "contact.heading": "Datos de tu negocio",
      "contact.sub":
        "Los usaremos para crear tu cuenta y confirmar el pedido.<br />Si ya pides con DisFruta, usa el enlace de arriba para buscar tu cuenta.<br /><br /><span class=\"section-sub-note\">Los campos con * son obligatorios</span>",
      "contact.name": "Nombre del negocio / cliente *",
      "contact.name_ph": "p. ej. Mercado Latino Fresh",
      "contact.phone": "Teléfono *",
      "contact.email": "Correo electrónico",
      "contact.email_ph": "pedidos@negocio.com",
      "contact.day": "Día de entrega preferido",
      "contact.day_select": "— Seleccionar —",
      "contact.day_mon": "Lunes",
      "contact.day_tue": "Martes",
      "contact.day_wed": "Miércoles",
      "contact.day_thu": "Jueves",
      "contact.day_fri": "Viernes",
      "contact.day_sat": "Sábado",
      "contact.frequency": "Frecuencia del pedido",
      "contact.freq_select": "— Seleccionar —",
      "contact.freq_weekly": "Semanal",
      "contact.freq_biweekly": "Cada 2 semanas",
      "contact.freq_3weeks": "Cada 3 semanas",
      "contact.freq_monthly": "Mensual",
      "contact.freq_twice": "Dos veces por semana",
      "contact.freq_other": "Otra",
      "contact.freq_other_label": "Describe tu frecuencia *",
      "contact.freq_other_ph": "p. ej. Cada dos jueves, omitir semanas festivas",
      "contact.freq_other_hint":
        "Cuéntanos con qué frecuencia quieres las entregas para armar el horario correcto.",
      "contact.language": "Idioma preferido",
      "contact.lang_en": "English",
      "contact.lang_es": "Español",
      "contact.address": "Dirección de entrega",
      "contact.address_ph": "Calle, ciudad, estado, código postal",

      "notice.cutoff":
        "Los pedidos deben enviarse antes de las <span class=\"notice-time\">5:00 PM</span> del día anterior a la entrega",
      "notice.cutoff_on":
        "Los pedidos deben enviarse antes de las <span class=\"notice-time\">5:00 PM</span> el {day} (el día anterior a la entrega)",
      "notice.cutoff_before":
        "Los pedidos deben enviarse antes de las <span class=\"notice-time\">5:00 PM</span> del día anterior a la entrega",
      "notice.new_review":
        "DisFruta revisa las cuentas nuevas antes de la primera entrega",
      "notice.day_before": "el día anterior a la entrega",

      "order_contact.heading": "¿Quién está haciendo este pedido?",
      "order_contact.sub":
        "Hay más de una persona en esta cuenta. Elige quién pide hoy.",
      "order_contact.label": "Contacto",
      "order_contact.primary": "principal",
      "order_contact.unnamed": "Contacto",
      "order_contact.as": "Pedido de {name}",
      "already.heading": "Pedido ya enviado",
      "already.body":
        "Ya hay un pedido para {date}. Gana el primero — no se aceptan pedidos adicionales de esta cuenta.",
      "already.body_declined":
        "Este período de entrega ya se omitió para {date}.",
      "already.help": "Si necesitas cambiarlo, contacta a DisFruta.",
      "already.toast": "Ya hay un pedido para esta entrega",

      "decline.heading": "¿No necesitas entrega en este período?",
      "decline.body":
        "Omite este ciclo por completo — sin factura, y dejamos de enviar recordatorios hasta tu próxima ventana de entrega.",
      "decline.btn": "Sin pedido este período",
      "decline.btn_footer": "No necesito pedido este período",
      "decline.btn_bar": "Omitir período",
      "decline.heading_admin": "¿El cliente omite este período?",
      "decline.body_admin":
        "Registrar sin entrega en este ciclo — sin factura y detener recordatorios.",
      "decline.btn_admin": "Declinar período (sin pedido)",
      "decline.confirm":
        "¿Omitir todo el período de pedido para {name}?\n\nEntrega: {period}\n\n• No se creará factura\n• Se detienen los recordatorios de este período\n• Puedes pedir de nuevo en el próximo ciclo",
      "decline.period_fallback": "este período de entrega",

      "cart.heading": "Tu pedido",
      "cart.heading_previous": "Tu pedido anterior",
      "cart.sub_new": "Agrega productos del catálogo abajo.",
      "cart.sub_new_picks":
        "Agrega productos de Selección del equipo o del catálogo abajo.",
      "cart.sub_returning":
        "Ajusta cantidades o quita artículos. Tu último pedido viene precargado.",
      "cart.empty_new": "Tu carrito está vacío",
      "cart.empty_returning": "Aún no hay artículos",
      "cart.empty_new_hint": "Explora productos para empezar tu pedido.",
      "cart.empty_new_hint_picks":
        "Explora productos o toca una Selección del equipo para empezar.",
      "cart.empty_returning_hint":
        "Tu pedido anterior aparecerá aquí cuando esté disponible. Agrega productos abajo.",
      "cart.remove": "Quitar",
      "cart.qty_for": "Cantidad de {name}",
      "cart.decrease": "Disminuir",
      "cart.increase": "Aumentar",
      "cart.quantity": "Cantidad",
      "cart.items_one": "{n} artículo",
      "cart.items_many": "{n} artículos",

      "promo.title": "Selección del equipo",
      "promo.sub":
        "Agrega con un toque los productos recomendados de esta semana.",
      "promo.tag": "Esta semana",
      "promo.add": "Agregar",
      "promo.add_more": "Agregar más",

      "browse.heading": "Agregar más artículos",
      "browse.sub":
        "Busca en el <strong>catálogo completo</strong> en cualquier momento (todas las categorías), o elige una categoría para explorar ese grupo. Usa <strong>Agregar todos</strong> para poner cada artículo de una categoría en tu pedido.",
      "browse.sub_preferred":
        "Mostrando <strong>tus categorías de siempre</strong>. Busca o elige abajo. ¿Necesitas algo más?",
      "browse.search_label": "Buscar todos los productos",
      "browse.search_label_preferred": "Buscar tus artículos de siempre",
      "browse.search_ph": "Buscar por nombre, SKU…",
      "browse.search_ph_preferred": "Buscar tus artículos de siempre…",
      "browse.scope_hint":
        "Buscando en <strong>todos los productos</strong> — el filtro de categoría se pausa mientras escribes.",
      "browse.scope_hint_preferred":
        "Buscando en <strong>tus categorías de siempre</strong> — toca Agregar otros artículos para buscar todo.",
      "browse.add_other": "Agregar otros artículos",
      "browse.preferred_only": "Ver solo lo habitual",
      "browse.scope_preferred": "Tus categorías de siempre.",
      "browse.scope_all": "Mostrando el catálogo completo.",
      "browse.matches_pref_one": "{n} coincidencia (tus categorías)",
      "browse.matches_pref_many": "{n} coincidencias (tus categorías)",
      "browse.empty_tip_preferred":
        "Consejo: toca <strong>Agregar otros artículos</strong> para ver el resto del catálogo.",
      "browse.add_all": "Agregar todos de la categoría",
      "browse.products_one": "{n} producto",
      "browse.products_many": "{n} productos",
      "browse.in_category": "{n} en la categoría",
      "browse.matches_one": "{n} coincidencia (todos los productos)",
      "browse.matches_many": "{n} coincidencias (todos los productos)",
      "browse.toolbar_one": "{n} producto en {category}",
      "browse.toolbar_many": "{n} productos en {category}",
      "browse.empty_loaded": "No se cargaron productos",
      "browse.empty_loaded_body":
        "Verifica que la hoja de Google esté compartida como “Cualquiera con el enlace → Lector” y actualiza. El catálogo de respaldo también podría faltar.",
      "browse.empty_match": "Ningún producto coincide",
      "browse.empty_search":
        "Nada coincidió con “{q}”. Prueba con menos palabras u otra ortografía.",
      "browse.empty_category": "No hay productos activos en “{category}”.",
      "browse.empty_tip":
        "Consejo: elige <strong>Todos</strong> o borra la búsqueda para ver todo.",
      "browse.in_order": "En el pedido: {n}",
      "browse.qty_add": "Cantidad a agregar",
      "browse.add": "Agregar",
      "browse.chip_title": "{category} — {n} productos",
      "browse.chip_aria": "{category}, {n} productos",
      "browse.product_fallback": "Producto",
      "cat.all": "Todos",
      "cat.pulps_short": "Pulpas {size}",

      "notes.heading": "Notas especiales",
      "notes.sub":
        "Instrucciones de entrega, sustituciones, muestras o cualquier otra cosa que debamos saber.",
      "notes.label": "Notas del pedido",
      "notes.ph": "p. ej. Dejar en la puerta trasera · Necesito muestra de arepas",
      "notes.ph_admin": "Notas del mensaje o llamada del cliente",

      "summary.label": "Resumen del pedido",
      "summary.total": "Total",
      "summary.submit": "Enviar pedido",
      "summary.submit_first": "Enviar primer pedido",
      "summary.submitting": "Enviando…",

      "admin.select_label": "Cliente (ID QuickBooks Online → Nombre)",
      "admin.select_placeholder": "— Elegir cliente —",
      "admin.help":
        "Al seleccionar un cliente se carga su encabezado y pedido anterior para pedir en su nombre (p. ej. cuando escriben en vez de usar el formulario).",

      "toast.lookup_account":
        "Busca tu cuenta con el teléfono registrado",
      "toast.choose_path": "Elige cliente nuevo o existente",
      "toast.new_disabled": "Los pedidos de clientes nuevos no están habilitados",
      "toast.use_sms_link":
        "Usa el enlace personalizado de tu mensaje de texto",
      "toast.invalid_phone": "Ingresa un número de teléfono válido.",
      "toast.no_account": "No encontramos una cuenta con ese número. ",
      "toast.no_account_new": "Empezar como cliente nuevo",
      "toast.no_account_sms":
        "Usa el enlace de tu SMS, o contacta a DisFruta.",
      "toast.welcome_back": "¡Bienvenido/a de nuevo, {name}!",
      "toast.item_removed": "Artículo eliminado",
      "toast.added": "Agregado al pedido",
      "toast.missing_sku": "No se pudo agregar (falta SKU)",
      "toast.not_in_catalog": "Producto no está en el catálogo",
      "toast.no_in_category": "No hay productos en esa categoría",
      "toast.all_already":
        "Todos los productos de esta categoría ya están en tu pedido",
      "toast.added_from_cat_one": "Se agregó {n} artículo de {category}",
      "toast.added_from_cat_many": "Se agregaron {n} artículos de {category}",
      "toast.select_customer": "Selecciona un cliente primero",
      "toast.open_link_first": "Abre primero el enlace de tu pedido",
      "toast.choose_first": "Elige primero cliente nuevo o existente",
      "toast.need_contact": "Ingresa el nombre del negocio y el teléfono",
      "toast.need_frequency_other": "Describe tu frecuencia de pedido",
      "toast.open_or_lookup":
        "Abre tu enlace personalizado o busca tu cuenta",
      "toast.need_items":
        "Agrega al menos un artículo — u omite este período si no necesitas entrega",
      "toast.open_to_skip":
        "Abre tu enlace personalizado para omitir este período",
      "toast.no_products": "No hay productos — revisa la consola",
      "confirm.add_all":
        "¿Agregar los {n} productos de “{category}” a tu pedido (cantidad 1 cada uno)?",

      "success.declined":
        "Sin pedido para <strong>{when}</strong>. No enviaremos más recordatorios de esta ventana de entrega, y no se creará factura. ¡Nos vemos en el próximo ciclo!",
      "success.with_invoice":
        "¡Gracias, {name}! Recibimos tu pedido por {total} — factura QuickBooks <strong>#{doc}</strong>. Recibirás una confirmación en breve.",
      "success.with_total":
        "¡Gracias, {name}! Recibimos tu pedido por {total}. Recibirás un mensaje de confirmación en breve.",
      "success.first_order":
        "¡Gracias, {name}! Recibimos tu primer pedido por {total}. Nuestro equipo confirmará tu cuenta y los detalles de entrega en breve.",
      "success.name_fallback": "amigo/a",
      "success.when_period": "este período",
      "error.generic": "Algo salió mal.",
      "error.load_failed":
        "No se pudo cargar el formulario. Sírvelo por HTTP (python3 -m http.server) para que products.json pueda cargar.",
    },
  };

  /** Display labels for catalog category keys (sheet values stay English). */
  const CATEGORY_LABELS = {
    en: {
      All: "All",
      General: "General",
      "Frozen Fruit Pulps 14 Oz": "Frozen Fruit Pulps 14 Oz",
      "Frozen Fruit Pulps 32 Oz": "Frozen Fruit Pulps 32 Oz",
      "Frozen Fruit Pulps 64 Oz": "Frozen Fruit Pulps 64 Oz",
      "Frozen Food": "Frozen Food",
      "Soda/Drinks": "Soda/Drinks",
      "Dry Food": "Dry Food",
    },
    es: {
      All: "Todos",
      General: "General",
      "Frozen Fruit Pulps 14 Oz": "Pulpas de fruta 14 Oz",
      "Frozen Fruit Pulps 32 Oz": "Pulpas de fruta 32 Oz",
      "Frozen Fruit Pulps 64 Oz": "Pulpas de fruta 64 Oz",
      "Frozen Food": "Comida congelada",
      "Soda/Drinks": "Refrescos/Bebidas",
      "Dry Food": "Comida seca",
    },
  };

  function normalizeLang(raw) {
    const v = String(raw || "")
      .trim()
      .toLowerCase();
    if (!v) return "";
    if (
      v === "es" ||
      v.startsWith("es-") ||
      v.startsWith("es_") ||
      v === "spanish" ||
      v === "español" ||
      v === "espanol"
    ) {
      return "es";
    }
    if (
      v === "en" ||
      v.startsWith("en-") ||
      v.startsWith("en_") ||
      v === "english" ||
      v === "inglés" ||
      v === "ingles"
    ) {
      return "en";
    }
    return "";
  }

  /**
   * Initial language before a customer is resolved:
   *  1) SMS/link ?lang= (Make should pass preferred language)
   *  2) Default English (customer preference applied when account loads)
   *
   * Browser / localStorage are not used for returning customers so we only
   * serve the language stored on their account.
   */
  function detectLang() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = normalizeLang(
        params.get("lang") || params.get("locale") || params.get("hl") || ""
      );
      if (fromUrl) return fromUrl;
    } catch (_) {
      /* ignore */
    }
    return "en";
  }

  let lang = detectLang();

  function getLocale() {
    return lang === "es" ? "es-US" : "en-US";
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] != null ? String(vars[k]) : `{${k}}`
    );
  }

  function t(key, vars) {
    const dict = STRINGS[lang] || STRINGS.en;
    const fallback = STRINGS.en[key];
    const raw = dict[key] != null ? dict[key] : fallback;
    if (raw == null) {
      console.warn("[DisFruta i18n] missing key:", key);
      return key;
    }
    return interpolate(raw, vars);
  }

  function tn(n, oneKey, manyKey, vars) {
    const key = Number(n) === 1 ? oneKey : manyKey;
    return t(key, { n, ...(vars || {}) });
  }

  function categoryLabel(category) {
    if (!category) return "";
    if (category === "All") return t("cat.all");
    const map = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
    if (map[category]) return map[category];
    // Short pulp chips: "Frozen Fruit Pulps 14 Oz" → "Pulpas 14 Oz" when ES
    const m = String(category).match(/^Frozen Fruit Pulps\s+(.+)$/i);
    if (m) return t("cat.pulps_short", { size: m[1] });
    return category;
  }

  function categoryChipShort(category) {
    if (!category || category === "All") return t("cat.all");
    const m = String(category).match(/^Frozen Fruit Pulps\s+(.+)$/i);
    if (m) return t("cat.pulps_short", { size: m[1] });
    return categoryLabel(category);
  }

  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (key) el.innerHTML = t(key);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (key) el.setAttribute("aria-label", t(key));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.setAttribute("title", t(key));
    });
    scope.querySelectorAll("[data-i18n-value]").forEach((el) => {
      const key = el.getAttribute("data-i18n-value");
      // Keep option value in English for form payload; only change label
      if (key) el.textContent = t(key);
    });

    document.documentElement.lang = lang === "es" ? "es" : "en";

    const titleKey = document.body?.dataset?.mode === "admin"
      ? "meta.title_admin"
      : "meta.title";
    if (document.title) document.title = t(titleKey);

    const desc = document.querySelector('meta[name="description"]');
    if (desc && document.body?.dataset?.mode !== "admin") {
      desc.setAttribute("content", t("meta.description"));
    }

    // Language switcher active state
    document.querySelectorAll("[data-set-lang]").forEach((btn) => {
      const l = btn.getAttribute("data-set-lang");
      btn.classList.toggle("active", l === lang);
      btn.setAttribute("aria-pressed", l === lang ? "true" : "false");
    });
  }

  /**
   * @param {string} next
   * @param {{ force?: boolean, persist?: boolean, updateUrl?: boolean, silent?: boolean, source?: string }} [opts]
   *   persist     — write localStorage (only for new-user choice / manual toggle)
   *   updateUrl   — rewrite ?lang= in the address bar (default false)
   *   silent      — apply DOM but skip disfruta:lang event (app will re-render)
   *   force       — re-apply even if language unchanged
   */
  function setLang(next, opts) {
    const options = opts || {};
    const l = normalizeLang(next) || "en";
    if (l === lang && !options.force) {
      applyDom();
      if (!options.silent) {
        window.dispatchEvent(
          new CustomEvent("disfruta:lang", {
            detail: { lang, locale: getLocale(), source: options.source || "" },
          })
        );
      }
      return lang;
    }
    lang = l;

    if (options.persist) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (_) {
        /* ignore */
      }
    }

    if (options.updateUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", lang);
        window.history.replaceState(
          {},
          "",
          url.pathname + url.search + url.hash
        );
      } catch (_) {
        /* ignore */
      }
    }

    applyDom();
    if (!options.silent) {
      window.dispatchEvent(
        new CustomEvent("disfruta:lang", {
          detail: { lang, locale: getLocale(), source: options.source || "" },
        })
      );
    }
    return lang;
  }

  /** Apply a customer's preferred language (Clients sheet / payload). */
  function applyCustomerLang(customer, opts) {
    const options = opts || {};
    const fromCustomer = normalizeLang(
      customer &&
        (customer.preferredLanguage ||
          customer.language ||
          customer.lang ||
          "")
    );
    let fromUrl = "";
    try {
      const params = new URLSearchParams(window.location.search);
      fromUrl = normalizeLang(
        params.get("lang") || params.get("locale") || params.get("hl") || ""
      );
    } catch (_) {
      /* ignore */
    }
    // Customer record wins; URL (SMS) is fallback when sheet has no language yet
    const next = fromCustomer || fromUrl || "en";
    return setLang(next, {
      source: options.source || "customer",
      persist: false,
      updateUrl: false,
      silent: Boolean(options.silent),
      force: Boolean(options.force),
    });
  }

  /**
   * Header EN|ES toggle — only active if the switcher markup is present.
   * Toggle is commented out in HTML; kept here for future use.
   */
  function bindSwitcher() {
    document.addEventListener("click", (e) => {
      const btn =
        e.target && e.target.closest && e.target.closest("[data-set-lang]");
      if (!btn) return;
      e.preventDefault();
      setLang(btn.getAttribute("data-set-lang"), {
        source: "manual",
        persist: true,
        updateUrl: false,
      });
    });
  }

  // Early apply when DOM is ready
  function boot() {
    applyDom();
    bindSwitcher();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.DisfrutaI18n = {
    t,
    tn,
    getLang: () => lang,
    getLocale,
    setLang,
    applyCustomerLang,
    normalizeLang,
    applyDom,
    categoryLabel,
    categoryChipShort,
    STRINGS,
  };
})();
