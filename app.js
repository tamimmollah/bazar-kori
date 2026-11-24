// বাজার করি — live app (vanilla JS, no build step)
// Modes: Supabase (when supabase-config.js is filled) OR Local Demo (localStorage).
// Supabase tables: profiles, products, orders, rider_payouts, settlements, rider_verifications (see supabase-schema.sql)
const BKASH = "01865-861015", DELIVERY_FEE = 30, OWNER_PHONE = "01865861015";
const $ = s => document.querySelector(s);
const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = n => "৳" + Number(n || 0).toLocaleString("en-IN");

// ---------- Multi-page (v15) ----------
// One static site, one page per section — no more single endless page.
// PAGE is the current file; QPARAMS reads ?cat=, ?q=, ?id=, ?track=, ?sort=.
// Cloudflare Pages serves clean URLs: /categories.html 308-redirects to
// /categories, so location.pathname has no ".html" live. Normalize PAGE so
// an extensionless last segment maps back to its .html file.
const _raw = (location.pathname.split("/").pop() || "").split("?")[0];
const PAGE = !_raw ? "index.html" : (_raw.includes(".") ? _raw : _raw + ".html");
const QPARAMS = new URLSearchParams(location.search || "");
const qp = k => QPARAMS.get(k) || "";

// ---------- Supabase ----------
let sb = null, LIVE = false;
function initSupabase() {
  const cfg = window.BAZARKORI_SUPABASE || {};
  if (cfg.url && cfg.anonKey && !cfg.url.includes("YOUR-PROJECT") && window.supabase) {
    try { sb = window.supabase.createClient(cfg.url, cfg.anonKey); LIVE = true;
      sb.channel("orders-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { loadOrders(); }).subscribe();
    } catch (e) { console.warn("Supabase init failed, demo mode", e); }
  }
  const b = $("#demoBanner"); if (b) b.style.display = LIVE ? "none" : "block";
}


// ---------- Shared header / nav / footer (v15) ----------
// Every page has <div id="shellHeader"></div> and <div id="shellFooter"></div>;
// mountShell() fills them with the SAME header, nav and footer, so the site
// looks like one organised shop instead of ten different pages. The login
// modal, toast and WhatsApp float are also injected here so they exist on
// every page.
function shellHTML() {
  const cats = ["All", ...window.BAZARKORI_CATEGORIES];
  const active = (p) => PAGE === p ? " active" : "";
  return `
<div class="topbar"><div class="topbar-track">
  <span>📍 Demra Thana + আশেপাশের এলাকা</span>
  <span>🚚 ফ্ল্যাট ৳৩০ ডেলিভারি • 💵 COD</span>
  <span>📞 <a href="tel:01865861015">01865-861015</a> • ⏰ খোলা: রাত ১২টা পর্যন্ত</span>
</div><div class="topbar-track" aria-hidden="true">
  <span>📍 Demra Thana + আশেপাশের এলাকা</span>
  <span>🚚 ফ্ল্যাট ৳৩০ ডেলিভারি • 💵 COD</span>
  <span>📞 <a href="tel:01865861015">01865-861015</a> • ⏰ খোলা: রাত ১২টা পর্যন্ত</span>
</div></div>
<header>
  <div class="hdr-row">
    <a class="logo" href="index.html" style="text-decoration:none"><img class="logo-img" src="logo.png" alt="বাজার করি"><span class="logo-tag">তাজা। সস্তা। ২৫ মিনিটে।</span></a>
    <div class="hdr-actions">
      <button class="icon-btn" onclick="openCartPopup()" aria-label="কার্ট">🛒 <span class="hdr-count" id="cartCount">0</span></button>
      <button class="icon-btn" onclick="location.href='orders.html'" aria-label="My Orders">📦 <span class="badge hidden" id="orderBadge">0</span></button>
      <button class="btn ghost hdr-login" id="loginBtn" onclick="location.href='login.html'">Login / Register</button>
      <button class="btn ghost hidden hdr-admin" id="adminBtn" onclick="location.href='admin.html'">Admin</button>
      <button class="btn ghost hidden" id="logoutBtn" onclick="logout()">Logout</button>
    </div>
  </div>
  <div class="search-row">
    <div class="search-group">
      <select id="hdrCatSelect" onchange="goCat(this.value)" aria-label="ক্যাটাগরি বেছে নিন">${cats.map(c => `<option value="${esc(c)}">${c === "All" ? "All Categories" : esc(c)}</option>`).join("")}</select>
      <input class="search" id="hdrSearch" placeholder="তেল, চাল, চিনি খুঁজুন…" onkeydown="if(event.key==='Enter')goSearch()">
      <button class="search-btn" onclick="goSearch()" aria-label="খুঁজুন">🔍</button>
    </div>
    <span id="whoami" class="muted hdr-whoami"></span>
    <span class="hdr-total muted">🛒 ৳<span id="cartTotal">0</span></span>
  </div>
</header>
<nav class="mainnav">
  <a class="nav-link${active("index.html")}" href="index.html">🏠 Home</a>
  <a class="nav-link${active("categories.html")}" href="categories.html">Categories</a>
  <a class="nav-link${active("deals.html")}" href="deals.html">জনপ্রিয় পণ্য</a>
  <a class="nav-link${active("about.html")}" href="about.html">About Us</a>
  <a class="nav-link${active("contact.html")}" href="contact.html">Contact Us</a>
</nav>
<div id="demoBanner" class="panel" style="max-width:1200px;margin:12px auto 0;background:#fff7d6;border-color:#f5a623">
  <b>Demo / Local mode:</b> Supabase is not configured yet (placeholder in <code>supabase-config.js</code>).
  Orders, riders and admin data are stored in this browser only. Fill in your free Supabase URL + anon key to go live — see README.md.
  <button class="btn small gold" onclick="requestNotify()">🔔 Enable browser notifications</button>
</div>`;
}
function footerHTML() {
  return `
<footer>
  <div class="footer-cols">
    <div class="footer-col brand">
      <img class="footer-logo" src="logo.png" alt="বাজার করি">
      <b>বাজার করি</b>
      <p>তাজা। সস্তা। ২৫ মিনিটে।<br>ডেমরার নিজের বাজার — তাজা বাজার, প্রতিদিন।</p>
    </div>
    <div class="footer-col">
      <b>Quick Links</b>
      <a href="index.html">Home</a>
      <a href="categories.html">Categories</a>
      <a href="deals.html">জনপ্রিয় পণ্য</a>
      <a href="about.html">About Us</a>
      <a href="contact.html">Contact Us</a>
    </div>
    <div class="footer-col">
      <b>Customer Service</b>
      <a href="orders.html">My Orders</a>
      <a href="orders.html">Order Tracking</a>
      <a href="https://wa.me/8801865861015" target="_blank" rel="noopener">WhatsApp-এ সাহায্য নিন</a>
      <a href="about.html">কেন বাজার করি?</a>
    </div>
    <div class="footer-col">
      <b>Categories</b>
      <span id="footerCats"></span>
    </div>
    <div class="footer-col">
      <b>Contact Us</b>
      <p>📍 Demra Thana, Dhaka<br>📞 <a href="tel:01865861015">01865-861015</a><br>💬 <a href="https://wa.me/8801865861015">WhatsApp</a><br>✉️ tamimmolla81@gmail.com<br>⏰ খোলা: রাত ১২টা পর্যন্ত</p>
      <b>We Accept</b>
      <p class="pay-badges"><span>COD</span><span>bKash</span></p>
    </div>
  </div>
  <div class="footer-bottom">© 2026 বাজার করি — All Rights Reserved. • Riders buy with their own money and keep only the delivery charge. 10% of delivery earnings is due daily via bKash.</div>
</footer>`;
}
function mountShell() {
  const h = document.getElementById("shellHeader");
  if (h) h.innerHTML = shellHTML();
  const f = document.getElementById("shellFooter");
  if (f) f.innerHTML = footerHTML();
  if (!document.getElementById("modal")) {
    document.body.insertAdjacentHTML("beforeend",
      '<div class="modal" id="modal"><div class="sheet" id="modalBody"></div></div>' +
      '<div class="toast" id="toast"></div>' +
      '<a class="wa-float" href="https://wa.me/8801865861015?text=%E0%A6%86%E0%A6%B8%E0%A6%B8%E0%A6%BE%E0%A6%B2%E0%A6%BE%E0%A6%AE%E0%A7%81%20%E0%A6%86%E0%A6%B2%E0%A6%BE%E0%A6%87%E0%A6%95%E0%A7%81%E0%A6%AE%2C%20%E0%A6%AC%E0%A6%BE%E0%A6%9C%E0%A6%BE%E0%A6%B0%20%E0%A6%95%E0%A6%B0%E0%A6%BF%20%E0%A6%A5%E0%A7%87%E0%A6%95%E0%A7%87%20%E0%A6%B8%E0%A6%BE%E0%A6%B9%E0%A6%BE%E0%A6%AF%E0%A7%8D%E0%A6%AF%20%E0%A6%A6%E0%A6%B0%E0%A6%95%E0%A6%BE%E0%A6%B0%E0%A5%A4" target="_blank" rel="noopener" aria-label="WhatsApp-এ সাহায্য নিন"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>');
  }
  // Fill the register area dropdown on login.html (if present).
  const ra = document.getElementById("rpArea");
  if (ra) ra.innerHTML = window.BAZARKORI_AREAS.map(a => `<option>${a}</option>`).join("");
}
// Category tile / footer link → categories page, pre-filtered.
function goCat(c) { location.href = "categories.html?cat=" + encodeURIComponent(c || "All"); }
// Header search → categories page with the search text.
function goSearch() { const v = ($("#hdrSearch") && $("#hdrSearch").value) || ""; location.href = "categories.html?q=" + encodeURIComponent(v.trim()); }

// ---------- Seed data ----------
function seed() {
  // Migration (v19): DELETE the demo orders seeded by v1–v18. A fresh account
  // must show NOTHING until that person actually places an order. Only
  // orders matching ALL THREE parts of the seed's own fingerprint are
  // deleted — a real order can never match all three at once:
  //   code LN-1001…LN-1006 AND customer "Demo Customer 1/2"
  //   AND phone 01710000002/01710000003.
  // Runs on every load (before the bazar_seeded early-return below) so
  // browsers that already hold the fake orders get cleaned on first v19 load.
  try {
    const DEMO_CODES = ["LN-1001", "LN-1002", "LN-1003", "LN-1004", "LN-1005", "LN-1006"];
    const DEMO_CUSTOMERS = ["Demo Customer 1", "Demo Customer 2"];
    const DEMO_PHONES = ["01710000002", "01710000003"];
    const cur = orders();
    const kept = cur.filter(o => !(DEMO_CODES.includes(o.code) && DEMO_CUSTOMERS.includes(o.customer) && DEMO_PHONES.includes(o.phone)));
    if (kept.length !== cur.length) setOrders(kept);
    // Demo-derived rows the seed also wrote: fake payout (TrxID "DEMO…")
    // and fake NID verification (NID 1234567890 for demo rider Rahim).
    const ps = ls("bazar_payouts", []);
    const keptPs = ps.filter(p => !(typeof p.trxid === "string" && p.trxid.indexOf("DEMO") === 0));
    if (keptPs.length !== ps.length) save("bazar_payouts", keptPs);
    const vs = ls("bazar_verifications", []);
    const keptVs = vs.filter(v => !(v.phone === "01710000006" && v.nid === "1234567890"));
    if (keptVs.length !== vs.length) save("bazar_verifications", keptVs);
  } catch {}
  // Migration (v11 rename): copy old "lagbe_*" localStorage keys to "bazar_*"
  // once, so existing accounts/orders/sessions survive the rename.
  try {
    if (!ls("bazar_seeded") && localStorage.getItem("lagbe_seeded")) {
      ["users", "orders", "cart", "session", "payouts", "settlements", "verifications", "seeded"].forEach(k => {
        const v = localStorage.getItem("lagbe_" + k);
        if (v !== null) localStorage.setItem("bazar_" + k, v);
      });
    }
  } catch {}
  // Migration (v6): browsers seeded before v6 still hold the old demo admin
  // account in localStorage. Replace it with the current owner account so the
  // old demo admin can no longer log in, and drop any session using it.
  try {
    const stored = ls("bazar_users", []);
    const old = stored.find(x => x.role === "admin" && x.phone !== OWNER_PHONE);
    if (old) {
      old.phone = OWNER_PHONE; old.pass = "tamim@gmail81"; old.name = "Tamim Mollah (Owner)";
      save("bazar_users", stored);
      const s = session();
      if (s && s.role === "admin" && s.phone !== OWNER_PHONE) save("bazar_session", null);
    }
  } catch {}
  // Migration (v9): riders get a delivery-areas list. Riders who never set
  // areas default to NO areas (area matching must be real) — except the demo
  // rider Karim, who is pre-set to Demra / Sarulia / Matuail.
  try {
    const stored2 = ls("bazar_users", []);
    let changed = false;
    stored2.forEach(x => {
      if (x.role === "rider" && !Array.isArray(x.areas)) {
        x.areas = x.phone === "01710000004" ? ["Demra", "Sarulia", "Matuail"] : [];
        changed = true;
      }
    });
    if (changed) save("bazar_users", stored2);
  } catch {}
  if (ls("bazar_seeded")) return;
  const users = [
    { phone: "01865861015", name: "Tamim Mollah (Owner)", role: "admin", pass: "tamim@gmail81", area: "Demra", verified: true, vstatus: "verified", online: false, banned: false },
    { phone: "01710000002", name: "Demo Customer 1", role: "customer", pass: "demo123", area: "Demra", verified: true, vstatus: "verified", online: false, banned: false },
    { phone: "01710000003", name: "Demo Customer 2", role: "customer", pass: "demo123", area: "Jatrabari", verified: true, vstatus: "verified", online: false, banned: false },
    { phone: "01710000004", name: "Karim Rider", role: "rider", pass: "demo123", area: "Demra", areas: ["Demra", "Sarulia", "Matuail"], verified: true, vstatus: "verified", online: true, banned: false },
    { phone: "01710000005", name: "Sumon Rider", role: "rider", pass: "demo123", area: "Matuail", areas: [], verified: true, vstatus: "verified", online: false, banned: false },
    { phone: "01710000006", name: "Rahim Rider", role: "rider", pass: "demo123", area: "Sarulia", areas: [], verified: false, vstatus: "pending", online: false, banned: false }
  ];
  save("bazar_users", users);
  // v19: NO demo orders anymore. A brand-new account sees NOTHING until it
  // actually places an order — the old seed wrote 6 fake orders (LN-1001…
  // LN-1006) that showed up in Live Tracking, Admin and the rider pool.
  // Orders / payouts / settlements / verifications all start empty.
  // (Only initialise keys that are absent — never overwrite existing data.)
  if (localStorage.getItem("bazar_orders") === null) save("bazar_orders", []);
  if (localStorage.getItem("bazar_payouts") === null) save("bazar_payouts", []);
  if (localStorage.getItem("bazar_settlements") === null) save("bazar_settlements", []);
  if (localStorage.getItem("bazar_verifications") === null) save("bazar_verifications", []);
  save("bazar_seeded", true);
}
const users = () => ls("bazar_users", []);
const orders = () => ls("bazar_orders", []);
const setUsers = u => save("bazar_users", u);
const setOrders = o => save("bazar_orders", o);
const session = () => ls("bazar_session", null);
function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.15); } catch {} }
function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; setTimeout(() => t.style.display = "none", 3200); }
function notify(m) { toast(m); beep(); if (Notification && Notification.permission === "granted") { try { new Notification("বাজার করি", { body: m }); } catch {} } }
function requestNotify() { if ("Notification" in window) Notification.requestPermission().then(p => toast(p === "granted" ? "Browser notifications ON" : "Notification permission: " + p)); }

// ---------- Email order notification to the owner (FormSubmit, free, fire-and-forget) ----------
// NOTE: FormSubmit sends a ONE-TIME activation email to tamimmolla81@gmail.com first.
// Tamim must click the activation link in that email once; until then these order
// emails will NOT arrive. The in-app admin badge/sound notification still works regardless.
const OWNER_EMAIL = "tamimmolla81@gmail.com";
function emailOrderNotify(o) {
  try {
    const itemsText = o.items.map(i => i.name + " ×" + i.qty + " — " + fmt(i.price * i.qty)).join("\n");
    fetch("https://formsubmit.co/ajax/" + OWNER_EMAIL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        _subject: "New বাজার করি order " + o.code + " — " + fmt(o.total),
        _template: "table", _captcha: "false",
        name: o.customer, phone: o.phone, order_code: o.code,
        area: o.area, address: o.address, items: itemsText,
        subtotal: o.subtotal, delivery_fee: o.fee, total: o.total,
        message: "New order " + o.code + " from " + o.customer + " (" + o.phone + "). Area: " + o.area + ". Address: " + o.address + ".\nItems:\n" + itemsText + "\nSubtotal: " + fmt(o.subtotal) + " + Delivery: " + fmt(o.fee) + " = Total: " + fmt(o.total) + " (COD)."
      })
    }).catch(() => {});
  } catch (e) { /* never block the order if email fails */ }
}

// ---------- Auth (v10: ONE unified login, no role choice, no owner link) ----------
// Just phone + password. The system decides by credentials:
// owner/admin account → admin session; customer account → customer session;
// rider account → "রাইডাররা অ্যাপ ব্যবহার করুন" (riders use the Android app;
// there is NO rider panel on the website anymore).
function openAuth() {
  const b = $("#modalBody");
  b.classList.remove("wide"); // v20: login sheet is narrow even after a wide cart popup
  b.innerHTML = `<img class="sheet-logo" src="logo.png" alt="বাজার করি"><h2>লগইন</h2>
  <p class="muted">ফোন নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন। নতুন হলে নিচে রেজিস্টার করুন।</p>
  <label>ফোন নম্বর</label><input id="aPhone" placeholder="01XXXXXXXXX">
  <label>পাসওয়ার্ড</label><input id="aPass" type="password" placeholder="পাসওয়ার্ড">
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn gold" onclick="doLogin()">লগইন</button><button class="btn ghost" onclick="closeModal()">বাতিল</button></div>
  <p class="muted">অ্যাকাউন্ট নেই? <a href="#" onclick="openRegister();return false;">রেজিস্টার করুন</a></p>`;
  $("#modal").classList.add("open");
}
// Registration is customer-only: name, phone, password, address.
// No role choice, no admin registration. Riders register via the app.
function openRegister() {
  const b = $("#modalBody");
  b.innerHTML = `<img class="sheet-logo" src="logo.png" alt="বাজার করি"><h2>রেজিস্টার — কাস্টমার</h2>
  <p class="muted">শুধু কাস্টমার রেজিস্ট্রেশন। রাইডাররা অ্যাপ ব্যবহার করুন।</p>
  <label>নাম</label><input id="rName" placeholder="আপনার নাম">
  <label>ফোন নম্বর</label><input id="rPhone" placeholder="01XXXXXXXXX">
  <label>পাসওয়ার্ড</label><input id="rPass" type="password" placeholder="পাসওয়ার্ড">
  <label>ঠিকানা</label><input id="rAddr" placeholder="বাসা, রোড, এলাকা">
  <label>এলাকা</label><select id="rArea">${window.BAZARKORI_AREAS.map(a => `<option>${a}</option>`).join("")}</select>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn gold" onclick="doRegister()">রেজিস্টার করুন</button><button class="btn ghost" onclick="openAuth()">লগইন করুন</button></div>`;
  $("#modal").classList.add("open");
}
// One unified login (phone + password). Used by the modal AND the login page.
function loginWith(phone, pass) {
  const u = users().find(x => x.phone === phone);
  if (!u || u.pass !== pass) return toast("ভুল ফোন নম্বর বা পাসওয়ার্ড।");
  if (u.role === "rider") {
    // Riders use the separate Android app — no rider panel on the website.
    const b = $("#modalBody");
    if (b) {
      b.innerHTML = `<h2>রাইডাররা অ্যাপ ব্যবহার করুন</h2><p>রাইডার প্যানেল এখন শুধু Android অ্যাপে আছে। অনুগ্রহ করে বাজার করি রাইডার অ্যাপ থেকে লগইন করুন।</p><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" onclick="closeModal()">ঠিক আছে</button></div>`;
      $("#modal").classList.add("open");
    }
    toast("রাইডাররা অ্যাপ ব্যবহার করুন");
    return;
  }
  if (u.banned) return toast("Your account is OFF / banned. Contact the owner on WhatsApp after payment.");
  save("bazar_session", u); closeModal(); renderAll();
  if (PAGE === "login.html") { location.href = u.role === "admin" ? "admin.html" : "index.html"; return; }
  toast(u.role === "admin" ? "Welcome, owner." : "Logged in as " + u.name);
  if (u.role === "customer") { syncProfileToSupabase(u); maybeAskProfile(); }
}
function doLogin() { const p = $("#aPhone"), w = $("#aPass"); if (p && w) loginWith(p.value.trim(), w.value); }
function loginFromPage() { const p = $("#lpPhone"), w = $("#lpPass"); if (p && w) loginWith(p.value.trim(), w.value); }
function registerWith(name, phone, pass, addr, area) {
  if (!name || !phone || !pass || !addr) return toast("নাম, ফোন, পাসওয়ার্ড ও ঠিকানা — সবগুলো দিন।");
  if (users().some(x => x.phone === phone)) return toast("এই ফোন নম্বরটি ইতিমধ্যে রেজিস্টার করা আছে। লগইন করুন।");
  const u = { phone, name, role: "customer", pass, area: area || window.BAZARKORI_AREAS[0], address: addr, verified: true, vstatus: "verified", online: false, banned: false };
  const all = users(); all.push(u); setUsers(all);
  insertProfileToSupabase(u); // real Supabase row, not just localStorage
  save("bazar_session", u); closeModal(); renderAll();
  if (PAGE === "login.html") { location.href = "index.html"; return; }
  toast("রেজিস্টার হয়েছে! বাজার করি-তে স্বাগতম।");
}
function doRegister() { const n = $("#rName"), p = $("#rPhone"), w = $("#rPass"), a = $("#rAddr"), ar = $("#rArea"); if (n && p && w && a) registerWith(n.value.trim(), p.value.trim(), w.value, a.value.trim(), ar ? ar.value : ""); }
function registerFromPage() { const n = $("#rpName"), p = $("#rpPhone"), w = $("#rpPass"), a = $("#rpAddr"), ar = $("#rpArea"); if (n && p && w && a) registerWith(n.value.trim(), p.value.trim(), w.value, a.value.trim(), ar ? ar.value : ""); }
function insertProfileToSupabase(u) {
  // Upsert by phone (unique): creates the row, or refreshes it if it exists.
  if (!LIVE || !sb) return;
  try { sb.from("profiles").upsert([{ phone: u.phone, name: u.name, role: "customer", password_hash: u.pass || "", area: u.area || null, address: u.address || null }], { onConflict: "phone" }).then(() => {}).catch(() => {}); } catch (e) {}
}

// ---------- Saved customer profile ----------
// A customer's name / phone / address is saved once and auto-filled at checkout.
// The popup asks for exactly those 3 things after login/register when any is missing.
function profileComplete(u) { return !!(u && u.name && u.phone && u.address); }
function maybeAskProfile() {
  const s = session();
  if (s && s.role === "customer" && !profileComplete(s)) openProfileModal();
}
function openProfileModal() {
  const s = session(); if (!s) return;
  const b = $("#modalBody");
  b.innerHTML = `<h2>আপনার তথ্য দিন</h2>
  <p class="muted">একবার তথ্য দিলেই পরের বার অর্ডার করার সময় নাম, ফোন ও ঠিকানা নিজে থেকেই বসে যাবে। পরে My Orders থেকে চাইলে বদলাতে পারবেন।</p>
  <label>নাম</label><input id="pName" placeholder="আপনার নাম" value="${esc(s.name || "")}">
  <label>ফোন নম্বর</label><input id="pPhone" placeholder="01XXXXXXXXX" value="${esc(s.phone || "")}">
  <label>ঠিকানা</label><input id="pAddr" placeholder="বাসা, রোড, এলাকা" value="${esc(s.address || "")}">
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn gold" onclick="saveProfile()">সংরক্ষণ করুন — Save</button><button class="btn ghost" onclick="closeModal()">পরে করব</button></div>`;
  $("#modal").classList.add("open");
}
function saveProfile() {
  const s = session(); if (!s) return;
  const name = $("#pName").value.trim(), phone = $("#pPhone").value.trim(), addr = $("#pAddr").value.trim();
  if (!name || !phone || !addr) return toast("নাম, ফোন নম্বর ও ঠিকানা — তিনটাই দিন।");
  if (phone !== s.phone && users().some(x => x.phone === phone)) return toast("এই ফোন নম্বরটি অন্য অ্যাকাউন্টে আছে।");
  saveProfileData(s.phone, { name, phone, address: addr });
  closeModal(); renderAll(); toast("প্রোফাইল সংরক্ষণ হয়েছে। পরের অর্ডারে তথ্য নিজে থেকেই বসবে।");
}
function saveProfileData(oldPhone, data) {
  const all = users(); const me = all.find(u => u.phone === oldPhone); if (!me) return;
  Object.assign(me, data); setUsers(all);
  const s = session(); if (s && s.phone === oldPhone) save("bazar_session", Object.assign({}, s, data));
  syncProfileToSupabase(me);
}
function syncProfileToSupabase(u) {
  // Upsert by phone (unique in Supabase profiles): creates the row if it is
  // missing, updates it if it exists. Local storage stays the working store.
  if (!LIVE || !sb) return;
  try { sb.from("profiles").upsert([{ phone: u.phone, name: u.name, role: u.role, password_hash: u.pass || "", area: u.area || null, address: u.address || null }], { onConflict: "phone" }).then(() => {}).catch(() => {}); } catch (e) {}
}
function logout() { localStorage.removeItem("bazar_session"); renderAll(); toast("Logged out."); if (PAGE === "admin.html" || PAGE === "orders.html") location.href = "index.html"; }
function closeModal() { trackCode = null; $("#modal").classList.remove("open"); $("#modalBody").classList.remove("wide"); }
// ---------- Reusable popup (modal) system (v20) ----------
// One overlay for every popup: product detail, cart/checkout, login, track.
// Tap outside the sheet or press ESC to close; opening a popup never
// triggers the v17 quiet-sync rebuild (userIsBusy() returns true while
// the modal is open). Focus lands on the ✕ button for keyboard users.
let _modalBound = false;
function openModal(html, opts) {
  const b = $("#modalBody");
  b.innerHTML = html;
  b.classList.toggle("wide", !!(opts && opts.wide));
  $("#modal").classList.add("open");
  const f = b.querySelector(".pop-close");
  if (f) { try { f.focus(); } catch (e) {} }
}
function bindModalDismiss() {
  if (_modalBound) return; _modalBound = true;
  const m = $("#modal"); if (!m) return;
  m.addEventListener("click", (e) => { if (e.target === m) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { const mm = $("#modal"); if (mm && mm.classList.contains("open")) closeModal(); }
  });
}
function requireLogin(role) { const s = session(); if (!s) { openAuth(); return null; } return s; }

// ---------- Storefront ----------
// v15: in-page anchors are now cross-page links. Same-section ids still
// scroll when they exist on the current page.
function goTo(id) {
  const map = { grid: "categories.html", catTiles: "categories.html", catTitle: "categories.html", deals: "deals.html", dealsHead: "deals.html", why: "about.html" };
  if (id === "siteFooter") { const f = document.getElementById("shellFooter"); if (f) f.scrollIntoView({ behavior: "smooth" }); return; }
  if (map[id]) {
    if (PAGE === map[id]) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); }
    else location.href = map[id];
    return;
  }
  const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" });
}
let activeCat = "All";
// ---------- Bilingual search (v15.2) ----------
// Bangla word → English synonyms, so typing বাংলায় finds the English-named
// products (e.g. "তেল" → oil, "চাল" → rice). Matching is case-insensitive.
// WORD-BOUNDARY RULE (v15.2 fix): an English term only matches a whole word
// (or the START of a word) in the product name/category — never a mid-word
// substring. "oil" used to match "t**oil**et" and "br**oil**er", so "তেল"
// returned toilet tissue and broiler chicken. Bangla terms still match by
// substring, because Bangla words have no spaces inside them.
const BN_EN = {
  "তেল": ["oil"], "চাল": ["rice"], "ভাত": ["rice"], "চিনি": ["sugar"],
  "লবণ": ["salt"], "লবন": ["salt"], "ডাল": ["lentil", "dal", "pulse"],
  "দুধ": ["milk"], "ডিম": ["egg"], "সাবান": ["soap"],
  "শ্যাম্পু": ["shampoo"], "চা": ["tea"], "কফি": ["coffee"],
  "বিস্কুট": ["biscuit", "cookies"], "চকলেট": ["chocolate"],
  "মসলা": ["spice", "masala"], "আটা": ["flour"], "ময়দা": ["flour"],
  "পানি": ["water"], "জুস": ["juice"],
  "কোল্ড ড্রিংকস": ["soft drink", "cold drink", "beverage", "drinks"],
  "সিগারেট": ["cigarette"], "পেঁয়াজ": ["onion"], "আলু": ["potato"],
  "টমেটো": ["tomato"], "মরিচ": ["chili", "chilli", "pepper"],
  "আদা": ["ginger"], "রসুন": ["garlic"], "মাছ": ["fish"],
  "মাংস": ["meat"], "মুরগি": ["chicken"], "গরু": ["beef"],
  "ফল": ["fruit"], "আপেল": ["apple"], "কলা": ["banana"],
  "পাউরুটি": ["bread"], "নুডলস": ["noodles"], "ঘি": ["ghee"],
  "মধু": ["honey"], "আইসক্রিম": ["ice cream"], "কেক": ["cake"],
  "টিস্যু": ["tissue"], "ডিটারজেন্ট": ["detergent"],
  "ভেপ": ["vape"], "টুথপেস্ট": ["toothpaste"],
  "ফেসওয়াশ": ["face wash"], "ক্রিম": ["cream"], "লোশন": ["lotion"],
  "সস": ["sauce"], "মেয়োনিজ": ["mayonnaise"], "চিপস": ["chips"],
  "বাদাম": ["nuts", "nut"], "খেজুর": ["dates", "date"], "সেমাই": ["vermicelli"],
  "সুজি": ["semolina"], "মিষ্টি": ["sweet"], "পাউডার": ["powder"],
  "হলুদ": ["turmeric"], "জিরা": ["cumin"], "ধনিয়া": ["coriander"],
  "এলাচ": ["cardamom"], "দারচিনি": ["cinnamon"], "লবঙ্গ": ["clove"],
  "গোলমরিচ": ["black pepper"], "সরিষা": ["mustard"], "নারকেল": ["coconut"],
  "সয়াবিন": ["soybean", "soyabean"], "সরিষার তেল": ["mustard oil"],
  "চিনাবাদাম": ["peanut"], "কাজু": ["cashew"], "কিশমিশ": ["raisin"],
  "পানীয়": ["drinks", "beverage"], "সবজি": ["vegetable"],
  "লেবু": ["lemon"], "কমলা": ["orange"], "আঙুর": ["grapes"],
  "পেয়ারা": ["guava"], "আম": ["mango"], "বেসন": ["gram flour", "besan"],
  "মশা": ["mosquito"], "স্যানিটারি": ["sanitary"], "ডায়াপার": ["diaper"]
};
// Romanized Bangla (Banglish) word → English synonyms, so typing Bangla in
// English letters finds the same products (e.g. "tel" → oil, "chal" →
// rice, "chini" → sugar). Same word-boundary rule as BN_EN: the English
// terms only match whole words (or word starts) in the product name.
const ROMAN_BN = {
  "tel": ["oil"], "teler": ["oil"], "chal": ["rice"], "chaler": ["rice"],
  "chini": ["sugar"], "lobon": ["salt"], "dal": ["lentil", "dal", "pulse"],
  "dudh": ["milk"], "dudher": ["milk"], "dim": ["egg"], "dimer": ["egg"],
  "saban": ["soap"], "shampoo": ["shampoo"], "cha": ["tea"],
  "coffee": ["coffee"], "biscuit": ["biscuit"], "chocolate": ["chocolate"],
  "mosla": ["spice", "masala"], "gorom mosla": ["garam masala"],
  "ata": ["flour"], "atta": ["flour"], "moyda": ["flour"],
  "pani": ["water"], "juice": ["juice"], "cigarette": ["cigarette"],
  "peyaj": ["onion"], "peyajer": ["onion"], "alu": ["potato"],
  "aloo": ["potato"], "tomato": ["tomato"], "tamatar": ["tomato"],
  "morich": ["chili", "chilli", "pepper"], "ada": ["ginger"],
  "roshun": ["garlic"], "mach": ["fish"], "mangsho": ["meat"],
  "murgi": ["chicken"], "goru": ["beef"], "fol": ["fruit"],
  "apel": ["apple"], "kola": ["banana"], "ghee": ["ghee"],
  "modhu": ["honey"], "honey": ["honey"], "icecream": ["ice cream"],
  "tissue": ["tissue"], "detergent": ["detergent"], "vape": ["vape"],
  "toothpaste": ["toothpaste"], "shorisha": ["mustard"],
  "shorishar tel": ["mustard oil"], "holud": ["turmeric"],
  "jira": ["cumin"], "dhonia": ["coriander"], "lobongo": ["clove"],
  "elach": ["cardamom"], "darchini": ["cinnamon"],
  "tejpata": ["bay leaf"], "shuji": ["semolina"],
  "chira": ["flattened rice"], "muri": ["puffed rice"],
  "gur": ["jaggery"], "narkel": ["coconut"], "badam": ["nuts", "nut"],
  "kaju": ["cashew"], "kishmish": ["raisin"], "khejur": ["dates", "date"],
  "doi": ["yogurt"], "ponir": ["cheese"], "makhon": ["butter"],
  "cream": ["cream"], "cake": ["cake"], "chips": ["chips"],
  "noodles": ["noodles"], "pasta": ["pasta"], "sauce": ["sauce"],
  "achar": ["pickle"], "jam": ["jam"], "jelly": ["jelly"],
  "powder": ["powder"], "lotion": ["lotion"],
  "facewash": ["face wash"], "brush": ["brush"], "razor": ["razor"],
  "blade": ["blade"], "napkin": ["napkin"], "diaper": ["diaper"],
  "baby": ["baby"], "medicine": ["medicine"], "syrup": ["syrup"],
  "tablet": ["tablet"], "capsule": ["capsule"], "condom": ["condom"],
  "sanitary": ["sanitary"], "pad": ["pad"], "agarbatti": ["incense"],
  "mombati": ["candle"], "match": ["match"], "coil": ["coil"],
  "spray": ["spray"], "air freshener": ["air freshener"],
  "phenyl": ["phenyl"], "harpic": ["harpic"], "vim": ["vim"],
  "surf": ["surf"], "wheel": ["wheel"], "rin": ["rin"], "lux": ["lux"],
  "lifebuoy": ["lifebuoy"], "dettol": ["dettol"], "savlon": ["savlon"],
  "pepsodent": ["pepsodent"], "colgate": ["colgate"],
  "closeup": ["closeup", "close up"], "sunsilk": ["sunsilk"],
  "dove": ["dove"], "ponds": ["ponds"], "fair": ["fair"],
  "vaseline": ["vaseline"], "nivea": ["nivea"], "parachute": ["parachute"],
  "dabur": ["dabur"], "himalaya": ["himalaya"],
  "pawruti": ["bread"], "semai": ["vermicelli"], "misty": ["sweet"],
  "misti": ["sweet"], "beson": ["gram flour", "besan"],
  "mosha": ["mosquito"], "lebu": ["lemon"], "komola": ["orange"],
  "angur": ["grapes"], "peyara": ["guava"], "aam": ["mango"],
  "sobji": ["vegetable"], "paniyo": ["drinks", "beverage"],
  "chinabadam": ["peanut"], "soya": ["soybean", "soyabean"],
  "soyabean": ["soybean", "soyabean"]
};
// Bangla label for each of the 22 categories, so a Bangla category word
// (e.g. "পানীয়", "আইসক্রিম") matches every product in that category.
const CAT_BN = {
  "Groceries": "মুদি বাজার", "Drinks & Beverages": "পানীয়",
  "Munchies": "হালকা খাবার", "Tong & Smokestore": "সিগারেট",
  "Smokeless & Vape": "ভেপ", "Sexual Wellness": "যৌন স্বাস্থ্য",
  "Pharmacy": "ঔষধ ফার্মেসি", "Ice Cream": "আইসক্রিম",
  "Sweets & Bakery": "মিষ্টি বেকারি", "Frozen Food": "ফ্রোজেন খাবার",
  "Feminine Care": "মহিলাদের যত্ন", "Baby Essentials": "শিশুর প্রয়োজনীয়",
  "Cleaning Essentials": "পরিষ্কার", "Bathroom Essentials": "বাথরুম",
  "Restaurants": "রেস্টুরেন্ট", "Street Foods": "স্ট্রিট ফুড",
  "Gym Essentials": "জিম", "Student Corner": "ছাত্র",
  "Party Store": "পার্টি", "Stationery": "স্টেশনারি",
  "Fruit & Vegetables": "ফল সবজি", "Meat & Fish": "মাছ মাংস"
};
// Split a product's searchable text into words (English + Bangla).
function hayWords(p) {
  const hay = (p.name + " " + p.unit + " " + p.category + " " + (CAT_BN[p.category] || "")).toLowerCase();
  return { hay, words: hay.split(/[^a-z0-9\u0980-\u09ff]+/i).filter(Boolean) };
}
// Does an English term match on word boundaries? Single word: equals the
// word or starts it ("oil" matches "oil", "oils"; never "toilet"/"broiler").
// Multi-word ("mustard oil", "ice cream"): the words must appear consecutively.
function wordMatch(words, term) {
  const ts = String(term).toLowerCase().split(/[^a-z0-9\u0980-\u09ff]+/).filter(Boolean);
  if (!ts.length) return false;
  if (ts.length === 1) return words.some(w => w === ts[0] || w.startsWith(ts[0]));
  for (let i = 0; i + ts.length <= words.length; i++) {
    if (ts.every((t, j) => words[i + j] === t || words[i + j].startsWith(t))) return true;
  }
  return false;
}
// One query term against one product: Bangla → substring; English →
// word-boundary match (see above).
function termMatches(p, term) {
  const { hay, words } = hayWords(p);
  if (/[\u0980-\u09ff]/.test(term)) return hay.includes(term.toLowerCase());
  return wordMatch(words, term);
}
function productMatches(p, q) {
  q = (q || "").toLowerCase().trim();
  if (!q) return true;
  const { hay } = hayWords(p);
  // Bangla query: direct substring first, then Bangla→English synonyms
  // (matched on word boundaries, so "তেল"→"oil" can't hit "toilet").
  if (/[\u0980-\u09ff]/.test(q)) {
    if (hay.includes(q)) return true;
    // Multi-word Bangla phrases first, e.g. "কোল্ড ড্রিংকস" → soft drink.
    for (const k of Object.keys(BN_EN)) {
      if (k.indexOf(" ") !== -1 && q.indexOf(k) !== -1 && BN_EN[k].some(s => termMatches(p, s))) return true;
    }
    // Every word must match directly or through its Bangla→English synonyms.
    return q.split(/\s+/).filter(Boolean).every(t =>
      hay.includes(t) || (BN_EN[t] || []).some(s => termMatches(p, s)));
  }
  // English query: every word must match on word boundaries — directly,
  // or through its Romanized-Bangla→English expansion ("tel" → oil).
  // Multi-word Roman phrases first, e.g. "gorom mosla" → garam masala.
  for (const k of Object.keys(ROMAN_BN)) {
    if (k.indexOf(" ") !== -1 && q.indexOf(k) !== -1 && ROMAN_BN[k].some(s => termMatches(p, s))) return true;
  }
  return q.split(/\s+/).filter(Boolean).every(t => {
    // A Romanized-Bangla word is Bangla written in Latin letters, NOT
    // English — match it ONLY through its English expansion, never raw:
    // raw prefix matching would let "chini" hit "Chinigura" rice.
    if (ROMAN_BN[t]) return ROMAN_BN[t].some(s => termMatches(p, s));
    return termMatches(p, t);
  });
}
function renderCats() {
  const cats = ["All", ...window.BAZARKORI_CATEGORIES];
  const chips = $("#cats");
  if (chips) chips.innerHTML = cats.map(c => `<button class="cat ${c === activeCat ? "active" : ""}" onclick="setCat('${esc(c)}')">${esc(c)}</button>`).join("");
  const sel = $("#catSelect");
  if (sel) sel.innerHTML = cats.map(c => `<option value="${esc(c)}" ${c === activeCat ? "selected" : ""}>${c === "All" ? "All Categories" : esc(c)}</option>`).join("");
  const fc = $("#footerCats");
  if (fc) fc.innerHTML = window.BAZARKORI_CATEGORIES.slice(0, 6).map(c => `<a href="categories.html?cat=${encodeURIComponent(c)}">${esc(c)}</a>`).join("");
}
// ---------- Category tiles (FreshMart-style "Shop by Category") ----------
function renderCatTiles() {
  const el = $("#catTiles"); if (!el) return;
  el.innerHTML = window.BAZARKORI_CATEGORIES.map(c => {
    const ps = window.BAZARKORI_PRODUCTS.filter(p => p.category === c);
    const first = ps[0]; if (!first) return "";
    return `<div class="cat-tile" onclick="goCat('${esc(c)}')">
      <img src="${first.img}" alt="${esc(c)}" loading="lazy" onerror="this.style.display='none'">
      <b>${esc(c)}</b><span>${ps.length} টি পণ্য</span></div>`;
  }).join("");
}
function setCat(c) { activeCat = c; renderProducts(); }
function is18(p) { return ["Tong & Smokestore", "Smokeless & Vape", "Sexual Wellness"].includes(p.category); }
let _prodRetry = 0;
function renderProducts() {
  const grid = $("#grid"); if (!grid) return;
  // If the catalog data isn't here yet (e.g. products.js still loading),
  // retry a few times instead of painting "No products found" on an empty grid.
  if (!window.BAZARKORI_PRODUCTS || !window.BAZARKORI_PRODUCTS.length) {
    if (_prodRetry < 5) { _prodRetry++; setTimeout(renderProducts, 300); }
    return;
  }
  _prodRetry = 0;
  const searchEl = $("#search");
  const q = ((searchEl ? searchEl.value : qp("q")) || "").toLowerCase();
  let list = window.BAZARKORI_PRODUCTS.filter(p => (activeCat === "All" || p.category === activeCat) && productMatches(p, q));
  const sortEl = $("#sortSelect");
  const sort = (sortEl && sortEl.value) || qp("sort") || "";
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
  else if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  const title = $("#catTitle");
  if (title) title.textContent = activeCat === "All" ? `Our Recommendations — ${list.length} products` : `${activeCat} — ${list.length} products"`
  grid.innerHTML = list.map(p => `<div class="card" onclick="openProduct(${p.id})">
    <img src="${p.img}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">
    <div class="pad"><h3>${esc(p.name)} ${is18(p) ? '<span class="tag18">18+ • Stealth Pack</span>' : ""}</h3>
    <div class="unit">${esc(p.unit)} • ${esc(p.category)}</div>
    <div class="row"><span class="price">${fmt(p.price)}</span><button class="add" onclick="event.stopPropagation();addToCart(${p.id})">ADD</button></div></div></div>`).join("") || "<p>No products found.</p>";
}
// ---------- Popular products (v16): every price is the real MRP.
// "আজকের জনপ্রিয় পণ্য" — the 6 most-bought products at their actual MRP.
// ---------- Featured strip under the hero (v13) ----------
const FEATURED = [["Radhuni Sunflower Oil", "1 L"], ["Coca-Cola Coke", "1 L"], ["Speed Can", "250 ml"], ["Pran Premium Ghee", "200 gm"], ["Lucky Strike Cool Crunch", "1 pack"]];
const DEALS = [...FEATURED, ["Fresh Rice Bran Oil", "2 L"]];
function renderDeals() {
  const el = $("#deals"); if (!el) return;
  el.innerHTML = DEALS.map(([n, u]) => {
    const p = window.BAZARKORI_PRODUCTS.find(x => x.name === n && x.unit === u); if (!p) return "";
    return `<div class="card" onclick="openProduct(${p.id})">
      <img src="${p.img}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">
      <div class="pad"><h3>${esc(p.name)}</h3><div class="unit">${esc(p.unit)}</div>
      <div class="row"><span class="price">${fmt(p.price)}</span><button class="add" onclick="event.stopPropagation();addToCart(${p.id})">ADD</button></div></div></div>`;
  }).join("");
}
function renderFeatured() {
  // v13 featured strip is now the "আজকের জনপ্রিয় পণ্য" section; kept as an
  // alias so any older caller still works.
  renderDeals();
}
// ---------- Product detail POPUP (v20) ----------
// Tapping a product card opens a popup on the SAME page — no navigation.
// product.html stays as a fallback for direct links (?id=).
let popQty = 1, popProductId = null;
function openProduct(id) {
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id); if (!p) return;
  if (is18(p) && !confirm("Age Verification: you must be 18+ to view this product. Are you 18 or older?")) return;
  openProductPopup(id);
}
function openProductPopup(id) {
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id); if (!p) return;
  popQty = 1; popProductId = id;
  openModal(`<div class="pop">
    <button class="pop-close" onclick="closeModal()" aria-label="Close">✕</button>
    <div class="pop-img"><img src="${p.img}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='logo.png'"></div>
    <h2 class="pop-title">${esc(p.name)} ${is18(p) ? '<span class="tag18">18+ • Stealth Pack</span>' : ""}</h2>
    <p class="pop-unit">Size: <b>${esc(p.unit)}</b> • Category: <b>${esc(p.category)}</b></p>
    <p class="pop-price">${fmt(p.price)}</p>
    <p class="muted">আসল MRP — কোনো ছাড় নেই • In stock • ২৫ মিনিটে ডেলিভারি • ফ্ল্যাট ৳৩০ • Cash on Delivery${is18(p) ? " • Discreet Stealth Pack." : ""}</p>
    <div class="qty-row"><button class="qty-btn" onclick="popQtyChange(-1)" aria-label="Decrease quantity">−</button><span id="popQty">1</span><button class="qty-btn" onclick="popQtyChange(1)" aria-label="Increase quantity">+</button>
    <button class="btn gold" id="popAddBtn" onclick="addPopToCart()">Add to Cart — ${fmt(p.price)}</button></div>
    <button class="btn ghost" style="width:100%" onclick="openCartPopup()">🛒 View Cart</button>
    <p style="text-align:center"><a href="javascript:void(0)" onclick="closeModal()">← Continue shopping</a></p>
  </div>`);
}
function popQtyChange(d) {
  popQty = Math.max(1, popQty + d);
  const q = $("#popQty"); if (q) q.textContent = popQty;
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === popProductId);
  const b = $("#popAddBtn"); if (b && p) b.textContent = "Add to Cart — " + fmt(p.price * popQty);
}
function addToCartQty(id, qty) {
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id); if (!p) return;
  const c = cart(); const f = c.find(x => x.id === id);
  if (f) f.qty += qty; else c.push({ id, name: p.name + " " + p.unit, price: p.price, qty, img: p.img });
  setCart(c); renderCart();
}
function addPopToCart() {
  if (!popProductId) return;
  addToCartQty(popProductId, popQty);
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === popProductId);
  toast("🛒 " + (p ? p.name : "") + " added.");
  const b = $("#popAddBtn");
  if (b) {
    const old = b.textContent; b.textContent = "✓ Added"; b.disabled = true;
    setTimeout(() => { const bb = $("#popAddBtn"); if (bb) { bb.textContent = old; bb.disabled = false; } }, 1200);
  }
}

// ---------- Cart & Checkout ----------
const cart = () => ls("bazar_cart", []);
const setCart = c => save("bazar_cart", c);
function addToCart(id) { const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id); if (!p) return; const c = cart(); const f = c.find(x => x.id === id); if (f) f.qty++; else c.push({ id, name: p.name + " " + p.unit, price: p.price, qty: 1, img: p.img }); setCart(c); renderCart(); toast(p.name + " added."); }
function addCustomItem() { const inp = $("#customItem"); if (!inp) return; const v = inp.value.trim(); if (!v) return; const c = cart(); c.push({ id: "custom-" + Date.now(), name: v + " (custom request)", price: 0, qty: 1, img: "" }); setCart(c); inp.value = ""; renderCart(); toast("Custom item added — we will confirm its price."); }
function changeQty(id, d) { const c = cart(); const f = c.find(x => String(x.id) === String(id)); if (!f) return; f.qty += d; if (f.qty <= 0) c.splice(c.indexOf(f), 1); setCart(c); renderCart(); }
function toggleCart() { openCartPopup(); }
function renderCart() {
  const c = cart(); const sub = c.reduce((a, i) => a + i.price * i.qty, 0);
  const cc = $("#cartCount"); if (cc) cc.textContent = c.reduce((a, i) => a + i.qty, 0);
  const ct = $("#cartTotal"); if (ct) ct.textContent = sub + (c.length ? DELIVERY_FEE : 0);
  const ci = $("#cartItems"); if (ci) ci.innerHTML = c.length ? c.map(i => `<div style="display:flex;gap:8px;align-items:center;border-bottom:1px solid #eee;padding:8px 0">
    ${i.img ? `<img src="${i.img}" style="width:48px;height:48px;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">` : ""}
    <div style="flex:1"><b>${esc(i.name)}</b><br><span class="muted">${fmt(i.price)} each</span></div>
    <button onclick="changeQty('${i.id}',-1)">−</button> ${i.qty} <button onclick="changeQty('${i.id}',1)">+</button>
    <b>${fmt(i.price * i.qty)}</b></div>`).join("") : "<p>Your cart is empty.</p>";
  const cs = $("#cartSummary"); if (cs) cs.innerHTML = c.length ? `<p>Subtotal: ${fmt(sub)}<br>Delivery Fee: ${fmt(DELIVERY_FEE)}<br><b>Total: ${fmt(sub + DELIVERY_FEE)}</b> (COD)</p>` : "";
  // Checkout auto-fill: saved profile by default; anything already typed in the
  // form wins, so the 8s refresh never wipes the customer's edits.
  const s = session();
  const cur = { name: $("#coName") ? $("#coName").value : "", phone: $("#coPhone") ? $("#coPhone").value : "", addr: $("#coAddr") ? $("#coAddr").value : "", area: $("#coArea") ? $("#coArea").value : "" };
  const dName = cur.name || (s && s.name) || "";
  const dPhone = cur.phone || (s && s.phone) || "";
  const dAddr = cur.addr || (s && s.address) || "";
  const dArea = cur.area || (s && s.area) || window.BAZARKORI_AREAS[0];
  const cb = $("#checkoutBox"); if (cb) cb.innerHTML = c.length ? `<label>Delivery Area</label><select id="coArea">${window.BAZARKORI_AREAS.map(a => `<option ${a === dArea ? "selected" : ""}>${a}</option>`).join("")}</select>
  <label>Full Address</label><input id="coAddr" placeholder="House, road, area" value="${esc(dAddr)}"><label>Your Name</label><input id="coName" placeholder="Name" value="${esc(dName)}"><label>Phone</label><input id="coPhone" placeholder="01XXXXXXXXX" value="${esc(dPhone)}">
  <button class="btn" style="width:100%;margin-top:8px" onclick="placeOrder()">Place Order — Cash on Delivery</button>` : "";
}
// ---------- Shared order creation (v20) ----------
// Used by the cart page AND the cart popup — one code path, one order code
// sequence, so the two can never drift apart.
function createOrder(name, phone, addr, area) {
  const s = session();
  const c = cart(); if (!c.length) return null;
  // Remember what the customer used at checkout, so next time it auto-fills.
  if (s && s.role === "customer") saveProfileData(s.phone, { name, phone, address: addr, area });
  const sub = c.reduce((a, i) => a + i.price * i.qty, 0);
  // v19: unique order code from the highest existing one. Length-based
  // codes could collide after the v19 demo-order cleanup shrank the list
  // (e.g. 6 real orders left → next code would repeat an existing one).
  const nextNum = Math.max(1000, ...orders().map(o => { const m = /^LN-(\d+)$/.exec(o.code || ""); return m ? Number(m[1]) : 0; })) + 1;
  const o = { code: "LN-" + nextNum, customer: name, phone, area, address: addr, items: c, subtotal: sub, fee: DELIVERY_FEE, total: sub + DELIVERY_FEE, status: "placed", statusLog: { placed: new Date().toISOString() }, rider: "", created: new Date().toISOString(), date: todayStr() };
  const all = orders(); all.unshift(o); setOrders(all); setCart([]);
  notify("Order " + o.code + " placed! Broadcasting to online riders…");
  emailOrderNotify(o); // fire-and-forget; admin badge/sound above still fires regardless
  if (LIVE && sb) sb.from("orders").insert([{ order_code: o.code, customer_name: name, customer_phone: phone, delivery_address: addr, area, items: c, subtotal_bdt: sub, delivery_fee_bdt: DELIVERY_FEE, total_bdt: o.total, status: "placed" }]).then(() => {});
  return o;
}
function placeOrder() {
  const s = requireLogin("customer"); if (!s) return;
  const c = cart(); if (!c.length) return toast("Cart is empty.");
  const name = $("#coName").value.trim() || s.name, phone = $("#coPhone").value.trim() || s.phone, addr = $("#coAddr").value.trim(), area = $("#coArea").value;
  if (!addr || !phone) return toast("Enter address and phone.");
  const o = createOrder(name, phone, addr, area); if (!o) return;
  renderCart(); renderAll();
  location.href = "orders.html?track=" + o.code; // orders page auto-opens the live countdown popup
}

// ---------- Cart / checkout POPUP (v20) ----------
// The cart button opens this popup instead of navigating to cart.html.
// cart.html still works as a fallback (direct link). The popup reuses the
// same data and totals; its form fields use p-prefixed IDs so they never
// collide with the cart page's identical fields behind the overlay.
function openCartPopup() {
  openModal(`<div class="pop pop-cart">
    <button class="pop-close" onclick="closeModal()" aria-label="Close">✕</button>
    <h2>🛒 আপনার কার্ট</h2>
    <div id="pCartItems"></div>
    <input id="pCustomItem" placeholder="Search or add custom item… (press Enter)" onkeydown="if(event.key==='Enter')addCustomItemPopup()">
    <p class="muted">Can't find a product? Type it above and press Enter — we will try to get it from a local dokan.</p>
    <div id="pCartSummary"></div>
    <div id="pCheckoutBox"></div>
  </div>`, { wide: true });
  renderCartPopup();
}
function renderCartPopup() {
  const items = $("#pCartItems"); if (!items) return; // cart popup is not open
  const c = cart(); const sub = c.reduce((a, i) => a + i.price * i.qty, 0);
  // Preserve anything already typed in the popup checkout form, so a qty
  // tap never wipes the customer's edits (same pattern as renderCart).
  const cur = { name: $("#pCoName") ? $("#pCoName").value : "", phone: $("#pCoPhone") ? $("#pCoPhone").value : "", addr: $("#pCoAddr") ? $("#pCoAddr").value : "", area: $("#pCoArea") ? $("#pCoArea").value : "" };
  items.innerHTML = c.length ? c.map(i => `<div class="pop-item">
    ${i.img ? `<img src="${i.img}" onerror="this.style.display='none'">` : ""}
    <div style="flex:1"><b>${esc(i.name)}</b><br><span class="muted">${fmt(i.price)} each</span></div>
    <button class="qty-btn" onclick="changeQtyPopup('${i.id}',-1)" aria-label="Decrease">−</button> ${i.qty} <button class="qty-btn" onclick="changeQtyPopup('${i.id}',1)" aria-label="Increase">+</button>
    <b>${fmt(i.price * i.qty)}</b></div>`).join("") : `<p>Your cart is empty.</p><button class="btn ghost" style="width:100%" onclick="closeModal()">← Continue shopping</button>`;
  const cs = $("#pCartSummary"); if (cs) cs.innerHTML = c.length ? `<p>Subtotal: ${fmt(sub)}<br>Delivery Fee: ${fmt(DELIVERY_FEE)}<br><b>Total: ${fmt(sub + DELIVERY_FEE)}</b> (COD)</p>` : "";
  const s = session();
  const dName = cur.name || (s && s.name) || "";
  const dPhone = cur.phone || (s && s.phone) || "";
  const dAddr = cur.addr || (s && s.address) || "";
  const dArea = cur.area || (s && s.area) || window.BAZARKORI_AREAS[0];
  const cb = $("#pCheckoutBox"); if (cb) cb.innerHTML = c.length ? `<label>Delivery Area</label><select id="pCoArea">${window.BAZARKORI_AREAS.map(a => `<option ${a === dArea ? "selected" : ""}>${a}</option>`).join("")}</select>
  <label>Full Address</label><input id="pCoAddr" placeholder="House, road, area" value="${esc(dAddr)}"><label>Your Name</label><input id="pCoName" placeholder="Name" value="${esc(dName)}"><label>Phone</label><input id="pCoPhone" placeholder="01XXXXXXXXX" value="${esc(dPhone)}">
  <button class="btn" style="width:100%;margin-top:8px" onclick="placeOrderPopup()">Place Order — Cash on Delivery</button>` : "";
}
function changeQtyPopup(id, d) { changeQty(id, d); renderCartPopup(); }
function addCustomItemPopup() {
  const inp = $("#pCustomItem"); if (!inp) return; const v = inp.value.trim(); if (!v) return;
  const c = cart(); c.push({ id: "custom-" + Date.now(), name: v + " (custom request)", price: 0, qty: 1, img: "" }); setCart(c);
  inp.value = ""; renderCart(); renderCartPopup(); toast("Custom item added — we will confirm its price.");
}
function placeOrderPopup() {
  const s = requireLogin("customer"); if (!s) return;
  const c = cart(); if (!c.length) return toast("Cart is empty.");
  const name = ($("#pCoName") && $("#pCoName").value.trim()) || s.name;
  const phone = ($("#pCoPhone") && $("#pCoPhone").value.trim()) || s.phone;
  const addr = $("#pCoAddr") ? $("#pCoAddr").value.trim() : "";
  const area = $("#pCoArea") ? $("#pCoArea").value : window.BAZARKORI_AREAS[0];
  if (!addr || !phone) return toast("Enter address and phone.");
  const o = createOrder(name, phone, addr, area); if (!o) return;
  renderCart(); closeModal();
  location.href = "orders.html?track=" + o.code; // orders page auto-opens the live countdown popup
}

// ---------- Order status flow (v7) ----------
// placed → accepted → picked_up → on_the_way → delivered. The rider advances
// one step at a time from his phone; the customer timeline shows the same
// steps with the time each step was completed. Steps can never be skipped.
const STATUS_FLOW = ["placed", "accepted", "picked_up", "on_the_way", "delivered"];
const STATUS_BN = {
  placed: "অর্ডার দেওয়া হয়েছে", accepted: "অর্ডার নেওয়া হয়েছে",
  picked_up: "পণ্য কেনা হয়েছে", on_the_way: "রাস্তায় আছে — বের হয়েছে",
  delivered: "ডেলিভারি হয়েছে"
};
const fmtTime = ts => { if (!ts) return ""; try { return new Date(ts).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) + " • " + new Date(ts).toLocaleDateString("bn-BD", { day: "numeric", month: "short" }); } catch { return ""; } };
function recordStatus(o, st) { o.statusLog = Object.assign({}, o.statusLog, { [st]: new Date().toISOString() }); o.status = st; }
function syncOrderStatus(o) {
  // Best-effort Supabase update, same pattern as the existing order insert:
  // a missing/failed update never blocks the local status change.
  if (!LIVE || !sb) return;
  try { sb.from("orders").update({ status: o.status }).eq("order_code", o.code).then(() => {}).catch(() => {}); } catch (e) {}
}

// ---------- Live countdown tracking (v9) ----------
// The countdown runs 25:00 from the moment a rider ACCEPTS. Before that the
// popup waits ("রাইডার কনফার্মের অপেক্ষায়…") and no timer runs. After 00:00
// it flips to overtime, counting UP ("+03:12") with a calm "দেরি হচ্ছে" label.
// When delivered it shows the total time taken and whether it was late.
const DELIVERY_TARGET_MS = 25 * 60 * 1000;
const BN_DIG = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
const bn = n => String(n).replace(/[0-9]/g, d => BN_DIG[d]);
const fmtMMSS = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
function timerState(o, nowMs) {
  const now = nowMs || Date.now();
  const log = o.statusLog || {};
  const acceptedAt = log.accepted ? new Date(log.accepted).getTime() : null;
  if (!acceptedAt) return { phase: "waiting" };
  const deliveredAt = log.delivered ? new Date(log.delivered).getTime() : null;
  if (deliveredAt) {
    const totalMs = deliveredAt - acceptedAt;
    return { phase: "delivered", totalMs, lateMs: totalMs - DELIVERY_TARGET_MS };
  }
  const elapsed = now - acceptedAt;
  if (elapsed < DELIVERY_TARGET_MS) return { phase: "counting", remainingMs: DELIVERY_TARGET_MS - elapsed };
  return { phase: "overtime", overtimeMs: elapsed - DELIVERY_TARGET_MS };
}
function timerDisplay(o, nowMs) {
  const st = timerState(o, nowMs);
  if (st.phase === "waiting") return Object.assign(st, { big: bn(25) + ":০০", sub: "রাইডার কনফার্মের অপেক্ষায়… — রাইডার কনফার্ম করলেই টাইমার শুরু হবে", cls: "waiting" });
  if (st.phase === "counting") return Object.assign(st, { big: fmtMMSS(st.remainingMs), sub: "ডেলিভারি হতে বাকি আছে", cls: "counting" });
  if (st.phase === "overtime") {
    const m = Math.floor(st.overtimeMs / 60000), s = Math.floor(st.overtimeMs % 60000 / 1000);
    return Object.assign(st, { big: "+" + fmtMMSS(st.overtimeMs), sub: "দেরি হচ্ছে — অতিরিক্ত " + bn(m) + " মিনিট " + bn(s) + " সেকেন্ড", cls: "overtime" });
  }
  const totalMin = Math.round(st.totalMs / 60000);
  const lateMin = Math.round(st.lateMs / 60000);
  return Object.assign(st, {
    big: "✓ ডেলিভারি হয়েছে",
    sub: st.lateMs <= 0 ? bn(totalMin) + " মিনিটে ডেলিভারি হয়েছে — সময়মতো ✓" : bn(lateMin) + " মিনিট দেরিতে ডেলিভারি হয়েছে",
    cls: "delivered"
  });
}
// Riders whose delivery areas include this area (verified, not banned).
function ridersCovering(area) {
  return users().filter(u => u.role === "rider" && !u.banned && u.verified && Array.isArray(u.areas) && u.areas.includes(area));
}
// ---------- Live tracking popup (v9) ----------
let trackCode = null;
function openTrackPopup(code) {
  trackCode = code;
  renderTrackPopup();
  $("#modal").classList.add("open");
}
function closeTrackPopup() { trackCode = null; closeModal(); }
function renderTrackPopup() {
  if (!trackCode) return;
  const o = orders().find(x => x.code === trackCode);
  if (!o) { $("#modalBody").innerHTML = "<p>অর্ডারটি পাওয়া যায়নি।</p>"; return; }
  $("#modal").setAttribute("data-track-status", o.status);
  const t = timerDisplay(o);
  const idx = STEPS.findIndex(x => x[0] === o.status);
  const log = o.statusLog || {};
  const unmatched = o.status === "placed" && !ridersCovering(o.area).length;
  $("#modalBody").innerHTML = `<div class="track-pop">
  <h2 style="margin-top:0">📍 লাইভ ট্র্যাক — ${o.code}</h2>
  <p class="muted">${fmt(o.total)} • ${esc(o.area)} • ${esc(o.address || "")}</p>
  <div class="track-timer ${t.cls}">${t.big}</div>
  <p class="track-sub">${t.sub}</p>
  ${unmatched ? `<p class="area-warn">⚠️ এই এলাকায় এখন কোনো রাইডার নেই</p>` : ""}
  ${o.rider ? `<p>🚴 রাইডার: <b>${esc(o.rider)}</b></p>` : `<p class="muted">রাইডার এখনো অর্ডারটি নেয়নি — কনফার্ম হলেই টাইমার শুরু হবে।</p>`}
  <div class="timeline">${STEPS.map((st, i) => `<div class="step ${i < idx ? "done" : i === idx ? "now" : ""}">${i < idx ? "✓ " : ""}${st[1]}${log[st[0]] ? `<br><span class="muted">${fmtTime(log[st[0]])}</span>` : ""}</div>`).join("")}</div>
  <p class="muted">${o.items.map(i => esc(i.name) + " ×" + i.qty).join(", ")}</p>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn gold" onclick="closeTrackPopup()">ঠিক আছে — Close</button><button class="btn ghost" onclick="closeTrackPopup();showView('orders')">My Orders দেখুন</button></div></div>`;
}
function updateCountdowns() {
  // 1-second tick for the small countdowns inside rider/admin panels.
  // The popup itself is re-rendered by the tick below.
  try {
    document.querySelectorAll(".js-countdown").forEach(el => {
      const o = orders().find(x => x.code === el.getAttribute("data-code"));
      if (!o) return;
      el.textContent = timerDisplay(o).big;
    });
  } catch (e) {}
}

// ---------- WhatsApp thank-you (v9, one-tap) ----------
// HONEST NOTE: a plain website cannot send a WhatsApp message fully
// automatically by itself — wa.me links always need one tap to send.
// Fully automatic sending needs the WhatsApp Business Cloud API (Meta) setup,
// which is a separate step for later. This is the one-tap version.
function waPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("880")) return d;
  if (d.startsWith("0")) return "880" + d.slice(1);
  return "880" + d;
}
function waThanksLink(o) {
  const p = waPhone(o.phone);
  if (!p) return "";
  const msg = "আসসালামু আলাইকুম! বাজার করি থেকে আপনার অর্ডার (" + o.code + ") ডেলিভারি হয়েছে। প্রোডাক্ট কেমন লাগলো? কোনো সমস্যা থাকলে আমাদের জানাবেন। ধন্যবাদ!";
  return "https://wa.me/" + p + "?text=" + encodeURIComponent(msg);
}
function waThanksBtn(o) {
  const link = waThanksLink(o);
  return link ? `<a class="wa-thanks-btn" href="${link}" target="_blank" rel="noopener">💬 WhatsApp-এ ধন্যবাদ জানান</a>` : "";
}

// ---------- Rider delivery areas (v9) ----------
// A rider only receives orders for the areas he chose. Riders who never set
// areas get NO orders — the rider panel prompts them to set areas first.
function saveRiderAreas() {
  const s = session(); if (!s || s.role !== "rider") return;
  const areas = [];
  document.querySelectorAll(".areaCb").forEach(cb => { if (cb.checked) areas.push(cb.value); });
  const all = users(); const me = all.find(u => u.phone === s.phone); if (!me) return;
  me.areas = areas; setUsers(all); save("bazar_session", Object.assign({}, s, { areas }));
  syncAreasToSupabase(me);
  renderAll(); toast(areas.length ? "ডেলিভারি এলাকা সংরক্ষণ হয়েছে: " + areas.join(", ") : "কোনো এলাকা ঠিক করা হয়নি — আপনার কাছে অর্ডার আসবে না।");
}
function syncAreasToSupabase(u) {
  // Best-effort only (localStorage is the working store in this build).
  if (!LIVE || !sb) return;
  try { sb.from("profiles").update({ areas: u.areas }).eq("phone", u.phone).then(() => {}).catch(() => {}); } catch (e) {}
}

// ---------- Customer tracking ----------
const STEPS = [["placed", "অর্ডার দেওয়া হয়েছে"], ["accepted", "অর্ডার নেওয়া হয়েছে"], ["picked_up", "পণ্য কেনা হয়েছে"], ["on_the_way", "রাস্তায় আছে"], ["delivered", "ডেলিভারি হয়েছে"]];
function renderMyOrders() {
  const s = session();
  // v19: a visitor who is not logged in sees NO orders at all (the old code
  // showed the 5 most recent orders to everyone, which is where the "random
  // orders in Live Tracking" came from). A logged-in customer sees only
  // their own orders.
  const list = s ? orders().filter(o => o.phone === s.phone || o.customer === s.name) : [];
  const profileBar = (s && s.role === "customer") ? `<div class="panel"><b>আমার প্রোফাইল</b><p class="muted">নাম: ${esc(s.name || "—")} • ফোন: ${esc(s.phone || "—")} • ঠিকানা: ${esc(s.address || "— (এখনো দেওয়া হয়নি)")}</p><button class="btn small gold" onclick="openProfileModal()">✏️ Edit Profile / প্রোফাইল বদলান</button></div>` : "";
  const mo = $("#myOrders"); if (!mo) return;
  mo.innerHTML = profileBar + (s ? "" : "<p class='muted'>অর্ডার দেখতে লগইন করুন।</p>") + (list.length ? list.map(o => {
    const idx = STEPS.findIndex(x => x[0] === o.status);
    const log = o.statusLog || {};
    return `<div class="panel"><b>${o.code}</b> • ${fmt(o.total)} • ${esc(o.area)} • <span class="pill ${o.status === "delivered" ? "ok" : "warn"}">${STATUS_BN[o.status] || o.status.replaceAll("_", " ")}</span>
    <button class="btn small gold" onclick="openTrackPopup('${o.code}')">📍 লাইভ ট্র্যাক</button>
    ${o.status === "placed" && !ridersCovering(o.area).length ? `<p class="area-warn">⚠️ এই এলাকায় এখন কোনো রাইডার নেই</p>` : ""}
    <div class="timeline">${STEPS.map((st, i) => `<div class="step ${i < idx ? "done" : i === idx ? "now" : ""}">${i < idx ? "✓ " : ""}${st[1]}${log[st[0]] ? `<br><span class="muted">${fmtTime(log[st[0]])}</span>` : ""}</div>`).join("")}</div>
    ${o.rider ? `<p>🚴 রাইডার: <b>${esc(o.rider)}</b>${o.status === "delivered" ? " • ডেলিভারি সম্পন্ন হয়েছে। ধন্যবাদ!" : o.status === "on_the_way" ? " • আপনার পার্সেল নিয়ে রাস্তায় আছে, শীঘ্রই পৌঁছে যাবে।" : o.status === "picked_up" ? " • পণ্য কিনে ফেলেছে, এখন রওনা হবে।" : " • আপনার অর্ডার নিয়েছে।"}</p>` : "<p class='muted'>রাইডারের জন্য অপেক্ষা করছি…</p>"}
    <p class="muted">${o.items.map(i => esc(i.name) + " ×" + i.qty).join(", ")}</p></div>`;
  }).join("") : "<p>এখনো কোনো অর্ডার নেই — প্রথম অর্ডার করলেই এখানে দেখাবে।</p>");
}

// ---------- Rider ----------
function fileToData(input, cb) { const f = input.files && input.files[0]; if (!f) return cb(""); const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); }
function renderRider() {
  // v10: the rider panel is REMOVED from the website (riders use the Android
  // app). The rider accept/status functions below stay in the code because the
  // app shares this logic — but there is no rider UI on the website anymore.
  const el = $("#riderPanel");
  if (!el) return;
  const s = session();
  if (!s || s.role !== "rider") { el.innerHTML = `<p>রাইডাররা অ্যাপ ব্যবহার করুন — রাইডার প্যানেল এখন শুধু Android অ্যাপে আছে।</p>`; return; }
  const me = users().find(u => u.phone === s.phone) || s;
  const pool = orders().filter(o => o.status === "placed" && (me.areas || []).includes(o.area));
  const mine = orders().filter(o => o.rider === me.name && o.status !== "delivered");
  const doneToday = orders().filter(o => o.rider === me.name && o.status === "delivered" && o.date === todayStr());
  const earnings = doneToday.length * DELIVERY_FEE, due = Math.round(earnings * 0.10);
  const pay = ls("bazar_payouts", []).find(p => p.rider === me.name && p.date === todayStr()) || { sent: 0, trxid: "" };
  const ver = ls("bazar_verifications", []).find(v => v.phone === me.phone);
  el.innerHTML = `
  <p><b>${esc(me.name)}</b> • ${esc(me.phone)} • ${esc(me.area)} •
  <span class="pill ${me.banned ? "bad" : me.verified ? "ok" : "warn"}">${me.banned ? "OFF / Banned" : me.verified ? "Verified Rider" : "Not Verified — " + me.vstatus}</span>
  ${me.banned ? "<p><b>Your account is OFF.</b> Pay your daily 10% on WhatsApp to the owner, then the admin will re-activate you.</p>" : ""}</p>
  <h3>Verification (NID)</h3>
  ${me.verified ? "<p class='pill ok'>Verified — you can go online.</p>" : `<p>Upload your photo + NID front/back. Your profile name must match your NID name.</p>
  <label>Your Photo</label><input type="file" accept="image/*" id="vPhoto"><label>NID Front</label><input type="file" accept="image/*" id="vFront"><label>NID Back</label><input type="file" accept="image/*" id="vBack">
  <label>NID Name</label><input id="vName" placeholder="Name exactly as on NID"><label>NID Number</label><input id="vNid" placeholder="NID number">
  <button class="btn" onclick="submitVerification()">Submit Verification</button>
  <p class="muted">Status: ${ver ? ver.status : me.vstatus}</p>`}
  <h3>Online / Offline</h3>
  <button class="btn ${me.online ? "danger" : "gold"}" onclick="toggleOnline()">${me.online ? "Go Offline" : "Go Online"}</button>
  <span class="muted">${me.online ? "You will receive new order broadcasts." : "Offline — no orders will come to you."}</span>
  <h3>📍 আমার ডেলিভারি এলাকা</h3>
  ${!me.areas || !me.areas.length ? `<p class="area-warn">⚠️ আপনি এখনো ডেলিভারি এলাকা ঠিক করেননি — এলাকা ঠিক না করলে আপনার কাছে অর্ডার আসবে না। নিচের এলাকাগুলো থেকে বেছে নিন।</p>` : `<p class="muted">শুধু এই এলাকাগুলোর অর্ডার আপনার কাছে আসবে। বদলাতে চাইলে নিচে ঠিক করে সংরক্ষণ করুন।</p>`}
  <div class="area-checks">${window.BAZARKORI_AREAS.map(a => `<label class="area-check"><input type="checkbox" class="areaCb" value="${esc(a)}" ${me.areas && me.areas.includes(a) ? "checked" : ""}> ${esc(a)}</label>`).join("")}</div>
  <button class="btn" onclick="saveRiderAreas()">এলাকা সংরক্ষণ করুন</button>
  <h3>Today — ${todayStr()}</h3>
  <div class="statgrid"><div class="stat"><b>${doneToday.length}</b>Orders delivered</div><div class="stat"><b>${fmt(earnings)}</b>Delivery earnings (৳30 × ${doneToday.length})</div><div class="stat"><b>${fmt(due)}</b>10% due today</div><div class="stat"><b>${fmt(pay.sent || 0)}</b>Sent (TrxID: ${esc(pay.trxid || "—")})</div></div>
  <p>Send <b>${fmt(due - (pay.sent || 0))}</b> today via bKash to owner: <b>${BKASH}</b></p>
  <label>Amount sent (৳)</label><input id="payAmt" type="number" placeholder="e.g. 6"><label>bKash TrxID</label><input id="payTrx" placeholder="TrxID">
  <button class="btn" onclick="markPaid()">I Sent via bKash</button>
  <h3>🔔 New Orders (broadcast pool — first Accept wins)</h3>
  ${!me.verified || me.banned || !me.online ? "<p class='muted'>Go online as a verified rider to see new orders.</p>" : !(me.areas && me.areas.length) ? "<p class='muted'>আগে উপরে আপনার ডেলিভারি এলাকা ঠিক করুন — এলাকা ছাড়া অর্ডার আসবে না।</p>" : pool.length ? pool.map(o => `<div class="panel"><b>${o.code}</b> — ${fmt(o.total)} • ${esc(o.area)} • ${esc(o.address)}<br><span class="muted">${o.items.map(i => esc(i.name) + " ×" + i.qty).join(", ")}</span><br><button class="btn gold" onclick="acceptOrder('${o.code}')">Accept — I will deliver</button></div>`).join("") : "<p>No new orders right now.</p>"}
  <h3>My Active Deliveries</h3>
  ${mine.length ? mine.map(o => {
    const idx = STATUS_FLOW.indexOf(o.status);
    const log = o.statusLog || {};
    const next = STATUS_FLOW[idx + 1];
    const NEXT_BTN = { picked_up: "🛍️ পণ্য কিনেছি — Bought / Picked up", on_the_way: "🛵 রাস্তায় আছি — On the way", delivered: "✅ ডেলিভারি করেছি — Delivered" };
    const td = timerDisplay(o);
    return `<div class="panel"><b>${o.code}</b> — ${STATUS_BN[o.status]} • ${fmt(o.total)} • ${esc(o.address)}<br>
    <div class="track-mini ${td.cls}">⏱ <span class="js-countdown" data-code="${o.code}">${td.big}</span> <span class="muted">${td.sub}</span></div>
    <span class="muted">${o.items.map(i => esc(i.name) + " ×" + i.qty).join(", ")} • ${esc(o.customer)} (${esc(o.phone)})</span>
    <div class="statusflow">${STATUS_FLOW.slice(1).map(st => {
      const si = STATUS_FLOW.indexOf(st);
      return `<div class="statusstep ${si < idx ? "done" : si === idx ? "now" : ""}">${si < idx ? "✓ " : ""}${STATUS_BN[st]}${log[st] ? `<br><span class="muted">${fmtTime(log[st])}</span>` : ""}</div>`;
    }).join("")}</div>
    ${next ? `<button class="status-btn" onclick="setStatus('${o.code}','${next}')">${NEXT_BTN[next]}</button>` : ""}
    <p class="muted">এক ধাপ করে আপডেট করুন — কাস্টমার তার ফোনে সাথে সাথে দেখতে পাবে।</p></div>`;
  }).join("") : "<p>এখনো কোনো ডেলিভারি নেই।</p>"}
  <h3>✅ আজ ডেলিভারি হয়েছে</h3>
  ${doneToday.length ? doneToday.map(o => `<div class="panel"><b>${o.code}</b> — ${fmt(o.total)} • ${esc(o.customer)} (${esc(o.phone)})<br><span class="muted">${timerDisplay(o).sub}</span><br>${waThanksBtn(o)}</div>`).join("") : "<p>আজ এখনো কোনো ডেলিভারি হয়নি।</p>"}`;
}
function submitVerification() {
  const s = session(); if (!s) return;
  const name = $("#vName").value.trim(), nid = $("#vNid").value.trim();
  if (!name || !nid) return toast("Enter NID name and number.");
  fileToData($("#vPhoto"), photo => fileToData($("#vFront"), front => fileToData($("#vBack"), back => {
    const vs = ls("bazar_verifications", []).filter(v => v.phone !== s.phone);
    vs.push({ rider: s.name, phone: s.phone, nidName: name, nid: nid, status: "pending", photo, front, back });
    save("bazar_verifications", vs);
    const all = users(); const me = all.find(u => u.phone === s.phone); if (me) { me.vstatus = "pending"; setUsers(all); }
    renderAll(); toast("Verification submitted. Admin will review your NID.");
  })));
}
function toggleOnline() {
  const s = session(); if (!s) return; const all = users(); const me = all.find(u => u.phone === s.phone);
  if (!me.verified) return toast("Verify your NID first — unverified riders cannot go online.");
  if (me.banned) return toast("Account is OFF. Pay and contact the owner.");
  me.online = !me.online; setUsers(all); save("bazar_session", me); renderAll();
}
function acceptOrder(code) {
  const s = session(); if (!s) return;
  const all = orders(); const o = all.find(x => x.code === code);
  if (!o || o.status !== "placed") return toast("Too late — another rider already accepted this order.");
  recordStatus(o, "accepted"); o.rider = s.name; setOrders(all); syncOrderStatus(o); renderAll(); notify("You accepted " + code + ". Buy with your own money and deliver.");
}
function setStatus(code, st) {
  // v7 guard: only the rider who accepted this order, and only the NEXT step —
  // a rider can never skip a step (e.g. delivered before on the way).
  const s = session(); if (!s || s.role !== "rider") return toast("Login as a rider first.");
  const all = orders(); const o = all.find(x => x.code === code); if (!o) return;
  if (o.rider !== s.name) return toast("This order is not yours.");
  const expected = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
  if (st !== expected) return toast("ধাপ বাদ দেওয়া যাবে না — আগে '" + (STATUS_BN[expected] || expected) + "' করতে হবে।");
  recordStatus(o, st); setOrders(all); syncOrderStatus(o); renderAll(); notify(code + " → " + (STATUS_BN[st] || st));
}
function markPaid() {
  const s = session(); if (!s) return;
  const amt = Number($("#payAmt").value || 0), trx = $("#payTrx").value.trim();
  if (!amt || !trx) return toast("Enter amount and bKash TrxID.");
  const ps = ls("bazar_payouts", []); const ex = ps.find(p => p.rider === s.name && p.date === todayStr());
  const done = orders().filter(o => o.rider === s.name && o.status === "delivered" && o.date === todayStr());
  if (ex) { ex.sent = amt; ex.trxid = trx; ex.orders = done.length; ex.earnings = done.length * DELIVERY_FEE; ex.due = Math.round(ex.earnings * 0.10); }
  else ps.push({ rider: s.name, date: todayStr(), orders: done.length, earnings: done.length * DELIVERY_FEE, due: Math.round(done.length * DELIVERY_FEE * 0.10), sent: amt, trxid: trx });
  save("bazar_payouts", ps); renderAll(); toast("Marked sent. Admin will approve it tonight.");
}

// ---------- Admin (single owner only) ----------
// Customers tab (v10): customer list comes from Supabase profiles first, with
// localStorage users as the fallback when Supabase is unreachable. Search
// filters live by name or phone, so Tamim can find any customer by name.
let adminTab = "orders";
let adminCustomers = null;
let custQuery = "";
function setAdminTab(t) { adminTab = t; renderAdmin(); if (t === "customers") loadCustomers(); }
function loadCustomers() {
  if (LIVE && sb) {
    try {
      sb.from("profiles").select("phone,name,address,area,role").eq("role", "customer")
        .then(({ data, error }) => {
          adminCustomers = (!error && Array.isArray(data) && data.length) ? data : users().filter(u => u.role === "customer");
          if (adminTab === "customers") renderCustomerList(custQuery);
        }).catch(() => { adminCustomers = users().filter(u => u.role === "customer"); if (adminTab === "customers") renderCustomerList(custQuery); });
      return;
    } catch (e) {}
  }
  adminCustomers = users().filter(u => u.role === "customer");
  if (adminTab === "customers") renderCustomerList(custQuery);
}
function renderCustomerList(q) {
  custQuery = q || "";
  const el = $("#custList"); if (!el) return;
  const list = adminCustomers || users().filter(u => u.role === "customer");
  const needle = custQuery.trim().toLowerCase();
  const filtered = needle ? list.filter(c => (c.name || "").toLowerCase().includes(needle) || (c.phone || "").includes(needle)) : list;
  const all = orders();
  el.innerHTML = filtered.length ? filtered.map(c => {
    const mine = all.filter(o => o.phone === c.phone || o.customer === c.name);
    const spent = mine.reduce((a, o) => a + o.total, 0);
    return `<div class="panel"><b>${esc(c.name || "—")}</b> • ${esc(c.phone || "—")}<br><span class="muted">${esc(c.address || c.area || "ঠিকানা দেওয়া হয়নি")}</span><br>অর্ডার: <b>${mine.length}</b> • মোট খরচ: <b>${fmt(spent)}</b></div>`;
  }).join("") : "<p>কোনো কাস্টমার পাওয়া যায়নি।</p>";
}
function renderAdmin() {
  const s = session(); const el = $("#adminPanel");
  if (!el) return;
  if (!s || s.role !== "admin") { el.innerHTML = `<p>Admin panel is for the owner only. There is <b>no admin registration</b>.</p><button class="btn" onclick="openAuth()">লগইন</button>`; return; }
  if (adminTab === "customers") {
    el.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px">
    <button class="btn ghost" onclick="setAdminTab('orders')">📦 অর্ডার</button>
    <button class="btn" onclick="setAdminTab('customers')">👥 কাস্টমার</button></div>
    <h3>কাস্টমার — নাম বা ফোন নম্বর দিয়ে খুঁজুন</h3>
    <input id="custSearch" placeholder="নাম বা ফোন নম্বর লিখুন…" value="${esc(custQuery)}" oninput="renderCustomerList(this.value)">
    <div id="custList"></div>`;
    if (!adminCustomers) loadCustomers(); else renderCustomerList(custQuery);
    return;
  }
  const all = orders(), t = todayStr(), todays = all.filter(o => o.date === t);
  const sales = todays.reduce((a, o) => a + o.subtotal, 0), fees = todays.reduce((a, o) => a + o.fee, 0);
  const riders = users().filter(u => u.role === "rider");
  const verifs = ls("bazar_verifications", []);
  const settlements = ls("bazar_settlements", []);
  const payouts = ls("bazar_payouts", []);
  el.innerHTML = `
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button class="btn" onclick="setAdminTab('orders')">📦 অর্ডার</button>
    <button class="btn ghost" onclick="setAdminTab('customers')">👥 কাস্টমার</button></div>
  <div class="statgrid">
    <div class="stat"><b>${todays.length}</b>Orders today</div>
    <div class="stat"><b>${todays.filter(o => o.status === "delivered").length}</b>Delivered today</div>
    <div class="stat"><b>${todays.filter(o => o.status === "placed" || o.status === "accepted").length}</b>Pending</div>
    <div class="stat"><b>${fmt(sales)}</b>Product sales today</div>
    <div class="stat"><b>${fmt(fees)}</b>Delivery charges today</div>
    <div class="stat"><b>${fmt(Math.round(fees * 0.10))}</b>10% commission due today</div>
    <div class="stat"><b>${all.length}</b>Total orders (all time)</div>
  </div>
  <h3>Live Orders ${all.filter(o => o.status === "placed").length ? `<span class="badge">${all.filter(o => o.status === "placed").length} new</span>` : ""}</h3>
  <table><tr><th>Order</th><th>Customer</th><th>Area</th><th>Total</th><th>Status</th><th>সময় / দেরি</th><th>Updated</th><th>Rider</th><th>ধন্যবাদ</th></tr>
  ${all.length ? all.slice(0, 30).map(o => {
    const log = o.statusLog || {}; const lastTs = log[o.status] || o.created;
    const td = timerDisplay(o);
    let timing = "";
    if (o.status === "delivered") timing = td.lateMs <= 0 ? `<span class="pill ok">${bn(Math.round(td.totalMs / 60000))} মিনিটে ✓ সময়মতো</span>` : `<span class="pill bad">${bn(Math.round(td.lateMs / 60000))} মিনিট দেরি</span>`;
    else if (o.status === "placed") timing = !ridersCovering(o.area).length ? `<span class="pill bad">⚠️ এই এলাকায় রাইডার নেই</span>` : `<span class="muted">রাইডার অপেক্ষায়</span>`;
    else timing = `<span class="js-countdown" data-code="${o.code}">${td.big}</span><br><span class="muted">${td.sub}</span>`;
    return `<tr><td>${o.code}</td><td>${esc(o.customer)}<br><span class="muted">${esc(o.phone)}</span></td><td>${esc(o.area)}</td><td>${fmt(o.total)}</td><td><span class="pill ${o.status === "delivered" ? "ok" : "warn"}">${STATUS_BN[o.status] || o.status.replaceAll("_", " ")}</span></td><td>${timing}</td><td>${fmtTime(lastTs)}</td><td>${esc(o.rider || "—")}</td><td>${o.status === "delivered" ? waThanksBtn(o) : "—"}</td></tr>`;
  }).join("") : `<tr><td colspan="9">এখনো কোনো অর্ডার আসেনি — কাস্টমার অর্ডার করলেই এখানে দেখাবে।</td></tr>`}</table>
  <h3>Rider Verification</h3>
  ${verifs.length ? verifs.map((v, i) => `<div class="panel"><b>${esc(v.nidName)}</b> (${esc(v.rider)}) • NID ${esc(v.nid)} • ${esc(v.phone)} • <span class="pill ${v.status === "verified" ? "ok" : v.status === "rejected" ? "bad" : "warn"}">${v.status}</span><br>
  ${v.photo ? `<img src="${v.photo}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">` : ""} ${v.front ? `<img src="${v.front}" style="width:120px;height:80px;object-fit:cover;border-radius:8px">` : ""} ${v.back ? `<img src="${v.back}" style="width:120px;height:80px;object-fit:cover;border-radius:8px">` : ""}
  <br><button class="btn small" onclick="reviewVerification(${i},'verified')">Approve</button> <button class="btn small danger" onclick="reviewVerification(${i},'rejected')">Reject</button></div>`).join("") : "<p>No verification requests.</p>"}
  <h3>Daily Settlement — Tonight's Checklist (${t})</h3>
  <p class="muted">Approve = rider stays active tomorrow. Not Approved = rider goes OFF/banned until you re-activate after WhatsApp payment.</p>
  <button class="btn small" onclick="buildSettlement()">Generate Tonight's Checklist</button>
  ${riders.map(r => {
    const d = orders().filter(o => o.rider === r.name && o.status === "delivered" && o.date === t);
    const earn = d.length * DELIVERY_FEE, due = Math.round(earn * 0.10);
    const pay = payouts.find(p => p.rider === r.name && p.date === t) || {};
    const st = settlements.find(x => x.rider === r.name && x.date === t);
    return `<div class="panel"><b>${esc(r.name)}</b> • ${d.length} orders • Earnings ${fmt(earn)} • 10% due ${fmt(due)} • Sent ${fmt(pay.sent || 0)} ${pay.trxid ? "(TrxID " + esc(pay.trxid) + ")" : "(not sent)"} • Status: ${r.banned ? "<b style='color:red'>OFF</b>" : "Active"} • Settlement: ${st ? st.status : "pending"}
    <br><button class="btn small" onclick="settleRider('${esc(r.phone)}','approved')">Approve</button>
    <button class="btn small danger" onclick="settleRider('${esc(r.phone)}','not_approved')">Not Approved</button>
    <button class="btn small gold" onclick="reactivateRider('${esc(r.phone)}')">Re-activate / ON</button></div>`;
  }).join("")}
  <h3>Riders</h3>
  <table><tr><th>Name</th><th>Phone</th><th>এলাকা</th><th>Verified</th><th>Online</th><th>Status</th></tr>${riders.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc((r.areas || []).join(", ") || "—")}</td><td>${r.verified ? "Yes" : r.vstatus}</td><td>${r.online ? "Online" : "Offline"}</td><td>${r.banned ? "OFF" : "Active"}</td></tr>`).join("")}</table>
  <h3>Settings</h3><p>Owner bKash (riders send 10% here): <b>${BKASH}</b> • Delivery fee: ${fmt(DELIVERY_FEE)} • Areas: ${window.BAZARKORI_AREAS.join(", ")}</p>
  <p class="muted">Admin account is one-time only. No one can register a second admin from this app.</p>`;
}
function reviewVerification(i, status) {
  const vs = ls("bazar_verifications", []); const v = vs[i]; if (!v) return;
  v.status = status; save("bazar_verifications", vs);
  const all = users(); const r = all.find(u => u.phone === v.phone);
  if (r) { r.verified = status === "verified"; r.vstatus = status; if (status === "verified") r.name = v.nidName; if (status !== "verified") r.online = false; setUsers(all); }
  renderAll(); toast("Rider " + status + ": " + v.nidName);
}
function buildSettlement() {
  const t = todayStr(); const ss = ls("bazar_settlements", []);
  users().filter(u => u.role === "rider").forEach(r => {
    if (ss.some(x => x.rider === r.name && x.date === t)) return;
    const d = orders().filter(o => o.rider === r.name && o.status === "delivered" && o.date === t);
    ss.push({ rider: r.name, date: t, orders: d.length, earnings: d.length * DELIVERY_FEE, due: Math.round(d.length * DELIVERY_FEE * 0.10), status: "pending" });
  });
  save("bazar_settlements", ss); renderAll(); toast("Tonight's settlement checklist generated.");
}
function settleRider(phone, status) {
  const t = todayStr(); const ss = ls("bazar_settlements", []);
  const r = users().find(u => u.phone === phone); if (!r) return;
  let row = ss.find(x => x.rider === r.name && x.date === t);
  const d = orders().filter(o => o.rider === r.name && o.status === "delivered" && o.date === t);
  if (!row) { row = { rider: r.name, date: t, orders: d.length, earnings: d.length * DELIVERY_FEE, due: Math.round(d.length * DELIVERY_FEE * 0.10), status }; ss.push(row); }
  else row.status = status;
  save("bazar_settlements", ss);
  const all = users(); const me = all.find(u => u.phone === phone);
  if (me) { me.banned = status === "not_approved"; if (me.banned) me.online = false; setUsers(all); }
  renderAll(); toast(r.name + " → " + status + (status === "not_approved" ? " (OFF/banned)" : ""));
}
function reactivateRider(phone) {
  const all = users(); const me = all.find(u => u.phone === phone); if (!me) return;
  me.banned = false; setUsers(all);
  const ss = ls("bazar_settlements", []); const row = ss.find(x => x.rider === me.name && x.date === todayStr()); if (row) row.status = "approved"; save("bazar_settlements", ss);
  renderAll(); toast(me.name + " re-activated.");
}


// ---------- Page setup (v15) ----------
// Reads the URL (?cat=, ?q=, ?sort=, ?id=, ?track=) and prepares the page.
function initPageParams() {
  if (PAGE === "categories.html") {
    if (qp("cat")) activeCat = qp("cat");
    const si = $("#search"); if (si && qp("q")) si.value = qp("q");
    const so = $("#sortSelect"); if (so && qp("sort")) so.value = qp("sort");
    const cs = $("#catSelect"); if (cs) cs.value = activeCat;
  }
  if (PAGE === "orders.html" && qp("track")) openTrackPopup(qp("track"));
  if (PAGE === "login.html") {
    const s = session(); const li = document.getElementById("loginInfo");
    if (li) li.innerHTML = s ? `<b>লগইন করা আছে:</b> ${esc(s.name)} (${esc(s.role)}) — <button class="btn small ghost" onclick="logout()">Logout</button>` : `<span class="muted">এখনো লগইন করা হয়নি। উপরে লগইন করুন বা নতুন অ্যাকাউন্ট বানান।</span>`;
  }
}

// ---------- Product detail page (v15) ----------
let detailQty = 1;
function renderProductDetail() {
  const el = $("#productDetail"); if (!el) return;
  const id = Number(qp("id"));
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id);
  if (!p) { el.innerHTML = `<p>পণ্যটি পাওয়া যায়নি।</p><p><a href="categories.html">← সব পণ্য দেখুন</a></p>`; return; }
  detailQty = 1;
  const similar = window.BAZARKORI_PRODUCTS.filter(x => x.category === p.category && x.id !== p.id).slice(0, 8);
  el.innerHTML = `
  <p><a href="categories.html">← সব পণ্য</a> • <a href="categories.html?cat=${encodeURIComponent(p.category)}">${esc(p.category)}</a></p>
  <div class="detail">
    <div class="detail-img"><img src="${p.img}" alt="${esc(p.name)}" onerror="this.style.display='none'"></div>
    <div class="detail-info">
      <h1>${esc(p.name)} ${is18(p) ? '<span class="tag18">18+ • Stealth Pack</span>' : ""}</h1>
      <p class="detail-unit">Size: <b>${esc(p.unit)}</b> • Category: <b>${esc(p.category)}</b></p>
      <p class="detail-price">${fmt(p.price)}</p>
      <p class="muted">In stock • Delivered in ~25 mins in ${window.BAZARKORI_AREAS.join(", ")} • Delivery fee ৳30 • Cash on Delivery${is18(p) ? " • Discreet Stealth Pack." : ""}</p>
      <div class="qty-row"><button class="qty-btn" onclick="detailQtyChange(-1)">−</button><span id="detailQty">1</span><button class="qty-btn" onclick="detailQtyChange(1)">+</button>
      <button class="btn gold" onclick="addDetailToCart(${p.id})">Add to Cart — ${fmt(p.price)}</button></div>
      <p><button class="btn ghost" onclick="openCartPopup()">🛒 Go to Cart</button></p>
    </div>
  </div>
  <div class="section-head"><h2>একই ক্যাটাগরির আরও পণ্য</h2><a href="categories.html?cat=${encodeURIComponent(p.category)}">View All →</a></div>
  <div class="grid">${similar.map(x => `<div class="card" onclick="openProduct(${x.id})">
    <img src="${x.img}" alt="${esc(x.name)}" loading="lazy" onerror="this.style.display='none'">
    <div class="pad"><h3>${esc(x.name)}</h3><div class="unit">${esc(x.unit)} • ${esc(x.category)}</div>
    <div class="row"><span class="price">${fmt(x.price)}</span><button class="add" onclick="event.stopPropagation();addToCart(${x.id})">ADD</button></div></div></div>`).join("") || "<p>এই ক্যাটাগরিতে আর কোনো পণ্য নেই।</p>"}</div>`;
}
function detailQtyChange(d) { detailQty = Math.max(1, detailQty + d); const q = $("#detailQty"); if (q) q.textContent = detailQty; }
function addDetailToCart(id) { for (let i = 0; i < detailQty; i++) addToCart(id); toast("কার্টে যোগ হয়েছে।"); }

// ---------- Views / init ----------
// Role gating (v10): the website has NO rider panel at all (riders use the
// Android app). A customer/visitor never sees Admin; the admin sees Admin
// only after logging in with the owner credentials in the unified login.
// v15: views are real pages now. Old showView() callers just navigate.
function showView(v) {
  if (v === "cart") { openCartPopup(); return; } // v20: cart opens as a popup, never a page
  const map = { store: "index.html", orders: "orders.html", admin: "admin.html", cart: "cart.html", login: "login.html" };
  if (v === "admin") { const s = session(); if (!s || s.role !== "admin") { openAuth(); toast("Admin panel দেখতে লগইন করুন।"); return; } }
  const target = map[v] || "index.html";
  if (PAGE === target) { if (v === "orders") renderMyOrders(); if (v === "admin") renderAdmin(); window.scrollTo(0, 0); return; }
  location.href = target;
}
function renderAll() {
  const s = session();
  const who = $("#whoami"); if (who) who.textContent = s ? `Logged in: ${s.name} (${s.role})` : "";
  const lb = $("#logoutBtn"); if (lb) lb.classList.toggle("hidden", !s);
  // Header buttons by role (v10): logged out → Login/Register only;
  // customer → no Admin button; admin (owner) → Admin button.
  // There is no Rider Panel button on the website at all.
  // Cart / My Orders stay visible to all.
  const loginBtn = $("#loginBtn"), adminBtn = $("#adminBtn");
  if (loginBtn) loginBtn.classList.toggle("hidden", !!s);
  if (adminBtn) adminBtn.classList.toggle("hidden", !s || s.role !== "admin");
  // v15: only render what exists on THIS page — each page has its own job.
  renderCats();
  if (PAGE === "index.html") { renderCatTiles(); renderDeals(); }
  else if (PAGE === "categories.html") { renderProducts(); }
  else if (PAGE === "deals.html") { renderDeals(); }
  else if (PAGE === "product.html") { renderProductDetail(); }
  else if (PAGE === "cart.html") { renderCart(); }
  else if (PAGE === "orders.html") { renderMyOrders(); }
  else if (PAGE === "admin.html") { renderAdmin(); }
  renderCart(); // header cart count + total, on every page (guarded inside)
  const newCount = orders().filter(o => o.status === "placed").length;
  const b = $("#orderBadge"); if (b) { b.textContent = newCount; b.classList.toggle("hidden", !newCount); }
}
// ---------- Init (v15.2) ----------
// BUG (v15, found live): categories.html grid was EMPTY on first load —
// products only appeared after clicking a chip and then "All".
// v15.1 ROOT CAUSE (found by testing the live files in real headless Chrome:
// the v15.1 code itself renders 232 cards on first load): the v15.1 fix only
// version-busted app.js on categories.html ("app.js?v=15.1"). A browser that
// had already cached the v15 categories.html (which referenced plain
// "app.js") and the v15 app.js kept running the OLD unguarded boot chain
// "seed(); mountShell(); initSupabase(); initPageParams(); renderAll();"
// where ANY one step throwing killed renderAll() — and the old code had no
// DOMContentLoaded handler and no retry, so the grid stayed empty forever
// (the throw also happened before the file's setInterval lines, so even the
// 8s re-render never got registered). Clicking a chip called the hoisted
// setCat() → renderProducts() directly, which is why clicks still worked.
// v15.2 fix: (1) EVERY page now loads EVERY local asset with ?v=15.2, so a
// stale cached file can never be served again — the new HTML references
// versioned URLs that cannot collide with old cache entries; (2) each init
// step runs in its own try/catch (v15.1); (3) DOMContentLoaded re-render
// (v15.1) PLUS a window-load re-render PLUS 300ms/1000ms retries that
// render the grid if it is still empty (below). renderAll/renderProducts
// are idempotent, so the extra renders are harmless.
function renderCategoriesIfEmpty() {
  if (PAGE !== "categories.html") return;
  const grid = $("#grid");
  if (grid && grid.querySelectorAll(".card").length === 0) {
    try { activeCat = qp("cat") || activeCat || "All"; renderCats(); renderProducts(); } catch (e) { console.warn("categories retry failed", e); }
  }
}
let _lastSyncSig = ""; // quiet-sync baseline, set in initApp (v17)
function initApp() {
  try { seed(); } catch (e) { console.warn("seed failed", e); }
  try { mountShell(); } catch (e) { console.warn("mountShell failed", e); }
  try { bindModalDismiss(); } catch (e) { console.warn("bindModalDismiss failed", e); } // v20: overlay tap + ESC close
  try { initSupabase(); } catch (e) { console.warn("initSupabase failed", e); }
  try { initPageParams(); } catch (e) { console.warn("initPageParams failed", e); }
  try { renderAll(); } catch (e) { console.warn("renderAll failed", e); }
  try { _lastSyncSig = ordersSig(); } catch (e) {} // quiet sync baseline (v17)
  // Belt-and-braces: if the grid is STILL empty shortly after load, render it.
  setTimeout(renderCategoriesIfEmpty, 300);
  setTimeout(renderCategoriesIfEmpty, 1000);
}
initApp();
if (typeof document !== "undefined" && document.addEventListener) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        if (PAGE === "categories.html") { activeCat = qp("cat") || "All"; renderCats(); renderProducts(); }
        else renderAll();
      } catch (e) { console.warn("DOMContentLoaded re-render failed", e); }
    });
  } else if (PAGE === "categories.html") {
    try { renderProducts(); } catch (e) { console.warn("categories re-render failed", e); }
  }
  window.addEventListener("load", () => {
    try { if (PAGE === "categories.html") renderCategoriesIfEmpty(); else renderAll(); } catch (e) { console.warn("load re-render failed", e); }
  });
}
// ---------- Quiet background sync (v17) ----------
// v16 and earlier re-rendered the ENTIRE page every 8 seconds
// (setInterval(renderAll, 8000)) — product images reloaded, scroll jumped,
// the search input lost focus: it felt like the site kept auto-refreshing.
// Now: every 8s we only compare a lightweight signature of the data that
// can change (orders + cart size + session). Only when something actually
// changed — and only while the user is NOT busy — do we touch the page,
// and then ONLY the orders-related parts (order badge, My Orders / admin
// list, header cart numbers). The product grid, hero, header and search
// are NEVER rebuilt by the sync.
function ordersSig() {
  try { return JSON.stringify({ o: orders(), c: cart().length, s: (session() || {}).phone || "" }); }
  catch (e) { return ""; }
}
function userIsBusy() {
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return true;
  const m = document.getElementById("modal");
  if (m && m.classList.contains("open")) return true;
  return false;
}
function updateOrderBadge() {
  const newCount = orders().filter(o => o.status === "placed").length;
  const b = $("#orderBadge"); if (b) { b.textContent = newCount; b.classList.toggle("hidden", !newCount); }
}
function updateHeaderCart() {
  const c = cart(); const sub = c.reduce((a, i) => a + i.price * i.qty, 0);
  const cc = $("#cartCount"); if (cc) cc.textContent = c.reduce((a, i) => a + i.qty, 0);
  const ct = $("#cartTotal"); if (ct) ct.textContent = sub + (c.length ? DELIVERY_FEE : 0);
}
function quietSync(force) {
  const sig = ordersSig();
  if (!force && sig === _lastSyncSig) return; // nothing changed: touch nothing
  if (!force && userIsBusy()) return; // busy now — do NOT consume the signature, retry next tick
  _lastSyncSig = sig;
  updateOrderBadge();
  updateHeaderCart();
  // Only the orders-related parts, and only on their own pages.
  if (PAGE === "orders.html") renderMyOrders();
  else if (PAGE === "admin.html") renderAdmin();
}
// Best-effort Supabase orders refresh (was called but never defined before
// v17 — the realtime handler used to throw here). Merges Supabase rows into
// the local order list, then lets the quiet sync decide what to update.
function loadOrders() {
  if (!LIVE || !sb) { quietSync(false); return; }
  try {
    sb.from("orders").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (error || !Array.isArray(data) || !data.length) { quietSync(false); return; }
        const local = orders();
        data.forEach(r => {
          const code = r.order_code;
          const ex = local.find(o => o.code === code);
          const mapped = { code, customer: r.customer_name, phone: r.customer_phone, area: r.area, address: r.delivery_address, items: r.items || [], subtotal: r.subtotal_bdt, fee: r.delivery_fee_bdt, total: r.total_bdt, status: r.status, statusLog: (ex && ex.statusLog) || { placed: r.created_at }, rider: (ex && ex.rider) || "", created: r.created_at, date: (r.created_at || "").slice(0, 10) };
          if (ex) Object.assign(ex, mapped); else local.unshift(mapped);
        });
        setOrders(local);
        quietSync(false);
        notify("New order update");
      }).catch(() => quietSync(false));
  } catch (e) { quietSync(false); }
}
// Quiet poll every 8s: an order placed in another tab/device appears
// (Supabase realtime does this live when configured).
setInterval(() => { try { quietSync(false); } catch (e) {} }, 8000);
// 1-second tick: update ONLY the countdown text nodes — never rebuild the
// popup or the page. The popup is fully re-rendered only when the order's
// STATUS itself changes (e.g. accepted → picked up).
setInterval(() => {
  try {
    updateCountdowns(); // small .js-countdown spans only, textContent swap
    if (!trackCode) return;
    const m = $("#modal");
    if (!m || !m.classList.contains("open")) return;
    const o = orders().find(x => x.code === trackCode);
    if (!o) return;
    if (m.getAttribute("data-track-status") !== o.status) { renderTrackPopup(); return; }
    const t = timerDisplay(o);
    const timerEl = m.querySelector(".track-timer");
    if (timerEl && timerEl.textContent !== t.big) { timerEl.textContent = t.big; timerEl.className = "track-timer " + t.cls; }
    const subEl = m.querySelector(".track-sub");
    if (subEl && subEl.textContent !== t.sub) subEl.textContent = t.sub;
  } catch (e) {}
}, 1000);
