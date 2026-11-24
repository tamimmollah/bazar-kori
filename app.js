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

// ---------- Supabase ----------
let sb = null, LIVE = false;
function initSupabase() {
  const cfg = window.BAZARKORI_SUPABASE || {};
  if (cfg.url && cfg.anonKey && !cfg.url.includes("YOUR-PROJECT") && window.supabase) {
    try { sb = window.supabase.createClient(cfg.url, cfg.anonKey); LIVE = true;
      sb.channel("orders-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { loadOrders(); renderAll(); notify("New order update"); }).subscribe();
    } catch (e) { console.warn("Supabase init failed, demo mode", e); }
  }
  const b = $("#demoBanner"); if (b) b.style.display = LIVE ? "none" : "block";
}

// ---------- Seed data ----------
function seed() {
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
  const mk = (code, cust, phone, items, status, rider, area) => {
    const sub = items.reduce((a, i) => a + i.price * i.qty, 0);
    const created = new Date(Date.now() - 1000 * 60 * 45).toISOString();
    // Seeded demo orders get a plausible per-step timestamp trail.
    const log = { placed: created };
    const flow = ["accepted", "picked_up", "on_the_way", "delivered"];
    const upto = flow.indexOf(status);
    flow.slice(0, upto + 1).forEach((st, i) => { log[st] = new Date(Date.now() - 1000 * 60 * (40 - i * 8)).toISOString(); });
    return { code, customer: cust, phone, area, items, subtotal: sub, fee: DELIVERY_FEE, total: sub + DELIVERY_FEE, status, statusLog: log, rider: rider || "", created, date: todayStr() };
  };
  save("bazar_orders", [
    mk("LN-1001", "Demo Customer 1", "01710000002", [{ id: 1, name: "Radhuni Sunflower Oil 1 L", price: 550, qty: 1 }], "delivered", "Karim Rider", "Demra"),
    mk("LN-1002", "Demo Customer 1", "01710000002", [{ id: 40, name: "Coca-Cola Coke 1 L", price: 95, qty: 2 }], "delivered", "Karim Rider", "Demra"),
    mk("LN-1003", "Demo Customer 2", "01710000003", [{ id: 55, name: "Speed Can 250 ml", price: 65, qty: 1 }], "on_the_way", "Karim Rider", "Jatrabari"),
    mk("LN-1004", "Demo Customer 2", "01710000003", [{ id: 70, name: "Lucky Strike 1 pack", price: 245, qty: 1 }], "accepted", "Sumon Rider", "Matuail"),
    mk("LN-1005", "Demo Customer 1", "01710000002", [{ id: 20, name: "Pran Premium Ghee 200 gm", price: 350, qty: 1 }], "placed", "", "Demra"),
    mk("LN-1006", "Demo Customer 2", "01710000003", [{ id: 30, name: "Aarong Low Fat Yogurt 500 gm", price: 125, qty: 1 }], "picked_up", "Karim Rider", "Sarulia")
  ]);
  save("bazar_payouts", [{ rider: "Karim Rider", date: todayStr(), orders: 2, earnings: 60, due: 6, sent: 6, trxid: "DEMO9HX7K2" }]);
  save("bazar_settlements", []);
  save("bazar_verifications", [{ rider: "Rahim Rider", phone: "01710000006", nidName: "Md Rahim Uddin", nid: "1234567890", status: "pending", photo: "", front: "", back: "" }]);
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
function doLogin() {
  const phone = $("#aPhone").value.trim(), pass = $("#aPass").value;
  const u = users().find(x => x.phone === phone);
  if (!u || u.pass !== pass) return toast("ভুল ফোন নম্বর বা পাসওয়ার্ড।");
  if (u.role === "rider") {
    // Riders use the separate Android app — no rider panel on the website.
    $("#modalBody").innerHTML = `<h2>রাইডাররা অ্যাপ ব্যবহার করুন</h2><p>রাইডার প্যানেল এখন শুধু Android অ্যাপে আছে। অনুগ্রহ করে বাজার করি রাইডার অ্যাপ থেকে লগইন করুন।</p><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" onclick="closeModal()">ঠিক আছে</button></div>`;
    return;
  }
  if (u.banned) return toast("Your account is OFF / banned. Contact the owner on WhatsApp after payment.");
  save("bazar_session", u); closeModal(); renderAll();
  toast(u.role === "admin" ? "Welcome, owner." : "Logged in as " + u.name);
  if (u.role === "customer") { syncProfileToSupabase(u); maybeAskProfile(); }
}
function doRegister() {
  const name = $("#rName").value.trim(), phone = $("#rPhone").value.trim(), pass = $("#rPass").value, addr = $("#rAddr").value.trim();
  if (!name || !phone || !pass || !addr) return toast("নাম, ফোন, পাসওয়ার্ড ও ঠিকানা — সবগুলো দিন।");
  if (users().some(x => x.phone === phone)) return toast("এই ফোন নম্বরটি ইতিমধ্যে রেজিস্টার করা আছে। লগইন করুন।");
  const u = { phone, name, role: "customer", pass, area: $("#rArea").value, address: addr, verified: true, vstatus: "verified", online: false, banned: false };
  const all = users(); all.push(u); setUsers(all);
  insertProfileToSupabase(u); // real Supabase row, not just localStorage
  save("bazar_session", u); closeModal(); renderAll(); toast("রেজিস্টার হয়েছে! বাজার করি-তে স্বাগতম।");
}
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
function logout() { localStorage.removeItem("bazar_session"); renderAll(); toast("Logged out."); }
function closeModal() { trackCode = null; $("#modal").classList.remove("open"); }
function requireLogin(role) { const s = session(); if (!s) { openAuth(); return null; } return s; }

// ---------- Storefront ----------
function goTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); }
let activeCat = "All";
function renderCats() {
  const cats = ["All", ...window.BAZARKORI_CATEGORIES];
  $("#cats").innerHTML = cats.map(c => `<button class="cat ${c === activeCat ? "active" : ""}" onclick="setCat('${esc(c)}')">${esc(c)}</button>`).join("");
  const sel = $("#catSelect");
  if (sel) sel.innerHTML = cats.map(c => `<option value="${esc(c)}" ${c === activeCat ? "selected" : ""}>${c === "All" ? "All Categories" : esc(c)}</option>`).join("");
  const fc = $("#footerCats");
  if (fc) fc.innerHTML = window.BAZARKORI_CATEGORIES.slice(0, 6).map(c => `<a href="javascript:void(0)" onclick="setCat('${esc(c)}');goTo('grid')">${esc(c)}</a>`).join("");
}
// ---------- Category tiles (FreshMart-style "Shop by Category") ----------
function renderCatTiles() {
  const el = $("#catTiles"); if (!el) return;
  el.innerHTML = window.BAZARKORI_CATEGORIES.map(c => {
    const ps = window.BAZARKORI_PRODUCTS.filter(p => p.category === c);
    const first = ps[0]; if (!first) return "";
    return `<div class="cat-tile" onclick="setCat('${esc(c)}');goTo('grid')">
      <img src="${first.img}" alt="${esc(c)}" loading="lazy" onerror="this.style.display='none'">
      <b>${esc(c)}</b><span>${ps.length} টি পণ্য</span></div>`;
  }).join("");
}
function setCat(c) { activeCat = c; renderProducts(); }
function is18(p) { return ["Tong & Smokestore", "Smokeless & Vape", "Sexual Wellness"].includes(p.category); }
function renderProducts() {
  const q = ($("#search").value || "").toLowerCase();
  let list = window.BAZARKORI_PRODUCTS.filter(p => (activeCat === "All" || p.category === activeCat) && (!q || (p.name + " " + p.unit + " " + p.category).toLowerCase().includes(q)));
  $("#catTitle").textContent = activeCat === "All" ? `Our Recommendations — ${list.length} products` : `${activeCat} — ${list.length} products`;
  $("#grid").innerHTML = list.map(p => `<div class="card" onclick="openProduct(${p.id})">
    <img src="${p.img}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">
    <div class="pad"><h3>${esc(p.name)} ${is18(p) ? '<span class="tag18">18+ • Stealth Pack</span>' : ""}</h3>
    <div class="unit">${esc(p.unit)} • ${esc(p.category)}</div>
    <div class="row"><span class="price">${fmt(p.price)}</span><button class="add" onclick="event.stopPropagation();addToCart(${p.id})">ADD</button></div></div></div>`).join("") || "<p>No products found.</p>";
}
// ---------- Deal of the Day (v14) — 10% off badge on selected popular items.
// The struck "original" price is computed honestly as round(price / 0.9);
// the price the customer actually pays is always the catalog price.
// ---------- Featured strip under the hero (v13) ----------
const FEATURED = [["Radhuni Sunflower Oil", "1 L"], ["Coca-Cola Coke", "1 L"], ["Speed Can", "250 ml"], ["Pran Premium Ghee", "200 gm"], ["Lucky Strike Cool Crunch", "1 pack"]];
const DEALS = [...FEATURED, ["Fresh Rice Bran Oil", "2 L"]];
function renderDeals() {
  const el = $("#deals"); if (!el) return;
  el.innerHTML = DEALS.map(([n, u]) => {
    const p = window.BAZARKORI_PRODUCTS.find(x => x.name === n && x.unit === u); if (!p) return "";
    const orig = Math.round(p.price / 0.9);
    return `<div class="card deal" onclick="openProduct(${p.id})">
      <span class="deal-badge">১০% ছাড়</span>
      <img src="${p.img}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">
      <div class="pad"><h3>${esc(p.name)}</h3><div class="unit">${esc(p.unit)}</div>
      <div class="row"><span class="price">${fmt(p.price)} <s class="old-price">${fmt(orig)}</s></span><button class="add" onclick="event.stopPropagation();addToCart(${p.id})">ADD</button></div></div></div>`;
  }).join("");
}
function renderFeatured() {
  // v13 featured strip is now the "আজকের ডিল" section; kept as an alias so
  // any older caller still works.
  renderDeals();
}
function openProduct(id) {
  const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id); if (!p) return;
  if (is18(p) && !confirm("Age Verification: you must be 18+ to view this product. Are you 18 or older?")) return;
  $("#modalBody").innerHTML = `<img src="${p.img}" onerror="this.style.display='none'"><h2>${esc(p.name)}</h2>
  <p><b>Size:</b> ${esc(p.unit)} • <b>Category:</b> ${esc(p.category)} • <b>Price:</b> ${fmt(p.price)}</p>
  <p class="muted">In stock • Delivered in ~25 mins in ${window.BAZARKORI_AREAS.join(", ")} • Delivery fee ৳30 • Cash on Delivery • ${is18(p) ? "Discreet Stealth Pack." : ""}</p>
  <div style="display:flex;gap:8px"><button class="btn gold" onclick="addToCart(${p.id});closeModal()">Add to Cart — ${fmt(p.price)}</button><button class="btn ghost" onclick="closeModal()">Close</button></div>`;
  $("#modal").classList.add("open");
}

// ---------- Cart & Checkout ----------
const cart = () => ls("bazar_cart", []);
const setCart = c => save("bazar_cart", c);
function addToCart(id) { const p = window.BAZARKORI_PRODUCTS.find(x => x.id === id); if (!p) return; const c = cart(); const f = c.find(x => x.id === id); if (f) f.qty++; else c.push({ id, name: p.name + " " + p.unit, price: p.price, qty: 1, img: p.img }); setCart(c); renderCart(); toast(p.name + " added."); }
function addCustomItem() { const v = $("#customItem").value.trim(); if (!v) return; const c = cart(); c.push({ id: "custom-" + Date.now(), name: v + " (custom request)", price: 0, qty: 1, img: "" }); setCart(c); $("#customItem").value = ""; renderCart(); toast("Custom item added — we will confirm its price."); }
function changeQty(id, d) { const c = cart(); const f = c.find(x => String(x.id) === String(id)); if (!f) return; f.qty += d; if (f.qty <= 0) c.splice(c.indexOf(f), 1); setCart(c); renderCart(); }
function toggleCart() { renderCart(); $("#cartDrawer").classList.toggle("open"); }
function renderCart() {
  const c = cart(); const sub = c.reduce((a, i) => a + i.price * i.qty, 0);
  $("#cartCount").textContent = c.reduce((a, i) => a + i.qty, 0); $("#cartTotal").textContent = sub + (c.length ? DELIVERY_FEE : 0);
  $("#cartItems").innerHTML = c.length ? c.map(i => `<div style="display:flex;gap:8px;align-items:center;border-bottom:1px solid #eee;padding:8px 0">
    ${i.img ? `<img src="${i.img}" style="width:48px;height:48px;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">` : ""}
    <div style="flex:1"><b>${esc(i.name)}</b><br><span class="muted">${fmt(i.price)} each</span></div>
    <button onclick="changeQty('${i.id}',-1)">−</button> ${i.qty} <button onclick="changeQty('${i.id}',1)">+</button>
    <b>${fmt(i.price * i.qty)}</b></div>`).join("") : "<p>Your cart is empty.</p>";
  $("#cartSummary").innerHTML = c.length ? `<p>Subtotal: ${fmt(sub)}<br>Delivery Fee: ${fmt(DELIVERY_FEE)}<br><b>Total: ${fmt(sub + DELIVERY_FEE)}</b> (COD)</p>` : "";
  // Checkout auto-fill: saved profile by default; anything already typed in the
  // form wins, so the 8s refresh never wipes the customer's edits.
  const s = session();
  const cur = { name: $("#coName") ? $("#coName").value : "", phone: $("#coPhone") ? $("#coPhone").value : "", addr: $("#coAddr") ? $("#coAddr").value : "", area: $("#coArea") ? $("#coArea").value : "" };
  const dName = cur.name || (s && s.name) || "";
  const dPhone = cur.phone || (s && s.phone) || "";
  const dAddr = cur.addr || (s && s.address) || "";
  const dArea = cur.area || (s && s.area) || window.BAZARKORI_AREAS[0];
  $("#checkoutBox").innerHTML = c.length ? `<label>Delivery Area</label><select id="coArea">${window.BAZARKORI_AREAS.map(a => `<option ${a === dArea ? "selected" : ""}>${a}</option>`).join("")}</select>
  <label>Full Address</label><input id="coAddr" placeholder="House, road, area" value="${esc(dAddr)}"><label>Your Name</label><input id="coName" placeholder="Name" value="${esc(dName)}"><label>Phone</label><input id="coPhone" placeholder="01XXXXXXXXX" value="${esc(dPhone)}">
  <button class="btn" style="width:100%;margin-top:8px" onclick="placeOrder()">Place Order — Cash on Delivery</button>` : "";
}
function placeOrder() {
  const s = requireLogin("customer"); if (!s) return;
  const c = cart(); if (!c.length) return toast("Cart is empty.");
  const name = $("#coName").value.trim() || s.name, phone = $("#coPhone").value.trim() || s.phone, addr = $("#coAddr").value.trim(), area = $("#coArea").value;
  if (!addr || !phone) return toast("Enter address and phone.");
  // Remember what the customer used at checkout, so next time it auto-fills.
  if (s.role === "customer") saveProfileData(s.phone, { name, phone, address: addr, area });
  const sub = c.reduce((a, i) => a + i.price * i.qty, 0);
  const o = { code: "LN-" + (1000 + orders().length + 1), customer: name, phone, area, address: addr, items: c, subtotal: sub, fee: DELIVERY_FEE, total: sub + DELIVERY_FEE, status: "placed", statusLog: { placed: new Date().toISOString() }, rider: "", created: new Date().toISOString(), date: todayStr() };
  const all = orders(); all.unshift(o); setOrders(all); setCart([]); renderCart(); toggleCart(); renderAll();
  notify("Order " + o.code + " placed! Broadcasting to online riders…");
  openTrackPopup(o.code); // v9: live countdown popup opens immediately
  emailOrderNotify(o); // fire-and-forget; admin badge/sound above still fires regardless
  if (LIVE && sb) sb.from("orders").insert([{ order_code: o.code, customer_name: name, customer_phone: phone, delivery_address: addr, area, items: c, subtotal_bdt: sub, delivery_fee_bdt: DELIVERY_FEE, total_bdt: o.total, status: "placed" }]).then(() => {});
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
  const list = s ? orders().filter(o => o.phone === s.phone || o.customer === s.name) : orders().slice(0, 5);
  const profileBar = (s && s.role === "customer") ? `<div class="panel"><b>আমার প্রোফাইল</b><p class="muted">নাম: ${esc(s.name || "—")} • ফোন: ${esc(s.phone || "—")} • ঠিকানা: ${esc(s.address || "— (এখনো দেওয়া হয়নি)")}</p><button class="btn small gold" onclick="openProfileModal()">✏️ Edit Profile / প্রোফাইল বদলান</button></div>` : "";
  $("#myOrders").innerHTML = profileBar + (s ? "" : "<p class='muted'>Login to see only your orders. Showing recent orders (demo).</p>") + (list.length ? list.map(o => {
    const idx = STEPS.findIndex(x => x[0] === o.status);
    const log = o.statusLog || {};
    return `<div class="panel"><b>${o.code}</b> • ${fmt(o.total)} • ${esc(o.area)} • <span class="pill ${o.status === "delivered" ? "ok" : "warn"}">${STATUS_BN[o.status] || o.status.replaceAll("_", " ")}</span>
    <button class="btn small gold" onclick="openTrackPopup('${o.code}')">📍 লাইভ ট্র্যাক</button>
    ${o.status === "placed" && !ridersCovering(o.area).length ? `<p class="area-warn">⚠️ এই এলাকায় এখন কোনো রাইডার নেই</p>` : ""}
    <div class="timeline">${STEPS.map((st, i) => `<div class="step ${i < idx ? "done" : i === idx ? "now" : ""}">${i < idx ? "✓ " : ""}${st[1]}${log[st[0]] ? `<br><span class="muted">${fmtTime(log[st[0]])}</span>` : ""}</div>`).join("")}</div>
    ${o.rider ? `<p>🚴 রাইডার: <b>${esc(o.rider)}</b>${o.status === "delivered" ? " • ডেলিভারি সম্পন্ন হয়েছে। ধন্যবাদ!" : o.status === "on_the_way" ? " • আপনার পার্সেল নিয়ে রাস্তায় আছে, শীঘ্রই পৌঁছে যাবে।" : o.status === "picked_up" ? " • পণ্য কিনে ফেলেছে, এখন রওনা হবে।" : " • আপনার অর্ডার নিয়েছে।"}</p>` : "<p class='muted'>রাইডারের জন্য অপেক্ষা করছি…</p>"}
    <p class="muted">${o.items.map(i => esc(i.name) + " ×" + i.qty).join(", ")}</p></div>`;
  }).join("") : "<p>No orders yet.</p>");
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
  }).join("") : "<p>None.</p>"}
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
  ${all.slice(0, 30).map(o => {
    const log = o.statusLog || {}; const lastTs = log[o.status] || o.created;
    const td = timerDisplay(o);
    let timing = "";
    if (o.status === "delivered") timing = td.lateMs <= 0 ? `<span class="pill ok">${bn(Math.round(td.totalMs / 60000))} মিনিটে ✓ সময়মতো</span>` : `<span class="pill bad">${bn(Math.round(td.lateMs / 60000))} মিনিট দেরি</span>`;
    else if (o.status === "placed") timing = !ridersCovering(o.area).length ? `<span class="pill bad">⚠️ এই এলাকায় রাইডার নেই</span>` : `<span class="muted">রাইডার অপেক্ষায়</span>`;
    else timing = `<span class="js-countdown" data-code="${o.code}">${td.big}</span><br><span class="muted">${td.sub}</span>`;
    return `<tr><td>${o.code}</td><td>${esc(o.customer)}<br><span class="muted">${esc(o.phone)}</span></td><td>${esc(o.area)}</td><td>${fmt(o.total)}</td><td><span class="pill ${o.status === "delivered" ? "ok" : "warn"}">${STATUS_BN[o.status] || o.status.replaceAll("_", " ")}</span></td><td>${timing}</td><td>${fmtTime(lastTs)}</td><td>${esc(o.rider || "—")}</td><td>${o.status === "delivered" ? waThanksBtn(o) : "—"}</td></tr>`;
  }).join("")}</table>
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

// ---------- Views / init ----------
// Role gating (v10): the website has NO rider panel at all (riders use the
// Android app). A customer/visitor never sees Admin; the admin sees Admin
// only after logging in with the owner credentials in the unified login.
function showView(v) {
  const s = session();
  if (v === "admin" && (!s || s.role !== "admin")) { openAuth(); toast("Admin panel দেখতে লগইন করুন।"); return; }
  ["store", "orders", "admin"].forEach(x => $("#view-" + x).classList.toggle("hidden", x !== v));
  if (v === "orders") renderMyOrders(); if (v === "admin") renderAdmin();
  window.scrollTo(0, 0);
}
function renderAll() {
  const s = session();
  $("#whoami").textContent = s ? `Logged in: ${s.name} (${s.role})` : "";
  $("#logoutBtn").classList.toggle("hidden", !s);
  // Header buttons by role (v10): logged out → Login/Register only;
  // customer → no Admin button; admin (owner) → Admin button.
  // There is no Rider Panel button on the website at all.
  // Cart / My Orders stay visible to all.
  const loginBtn = $("#loginBtn"), adminBtn = $("#adminBtn");
  if (loginBtn) loginBtn.classList.toggle("hidden", !!s);
  if (adminBtn) adminBtn.classList.toggle("hidden", !s || s.role !== "admin");
  // Safety net: if the admin view is open and the session is no longer the
  // owner (e.g. after logout), close it back to the store — without calling
  // showView (avoids recursion).
  if (!$("#view-admin").classList.contains("hidden") && (!s || s.role !== "admin")) {
    $("#view-admin").classList.add("hidden"); $("#view-store").classList.remove("hidden");
  }
  renderCats(); renderCatTiles(); renderDeals(); renderProducts(); renderCart(); renderMyOrders(); renderAdmin();
  const newCount = orders().filter(o => o.status === "placed").length;
  const b = $("#orderBadge"); b.textContent = newCount; b.classList.toggle("hidden", !newCount);
}
seed(); initSupabase(); renderAll();
// Poll every 8s so an order placed in another tab/device appears (Supabase realtime does this live when configured).
setInterval(() => { renderAll(); }, 8000);
// 1-second tick: live countdown popup + rider/admin countdowns.
setInterval(() => { if (trackCode && $("#modal").classList.contains("open")) renderTrackPopup(); updateCountdowns(); }, 1000);
