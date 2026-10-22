/* Borrower Profiles — view-only customer profiles (same look as Loan CRM / CVE CRM) */
(function () {
  'use strict';
  const CFG = window.BP_CONFIG;
  const LS = { TOKEN: 'bp_token', USER: 'bp_user', DATA: 'bp_data', THEME: 'bp_theme' };
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = s => Number(String(s == null ? '' : s).replace(/[^\d.-]/g, '')) || 0;
  const has = v => v != null && String(v).trim() !== '' && String(v).trim() !== '-';

  const state = {
    token: get(LS.TOKEN), user: getJson(LS.USER), data: getJson(LS.DATA),
    screen: 'home', q: '', loan: 'All', prio: 'All', fit: null, segMode: 'age', segOpen: null, detailId: null, busy: false
  };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function getJson(k) { try { return JSON.parse(get(k) || 'null'); } catch (e) { return null; } }
  try { const t = get(LS.THEME); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  // ---------------------------------------------------------------- helpers
  const sv = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    search: sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    back: sv('<path d="M15 18l-6-6 6-6"/>'),
    chev: sv('<path d="m9 18 6-6-6-6"/>'),
    refresh: sv('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
    sheet: sv('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
    moon: sv('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    out: sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    heart: sv('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
    child: sv('<circle cx="12" cy="6" r="3"/><path d="M8 21v-5l-2-3 3-2h6l3 2-2 3v5"/>'),
    elder: sv('<circle cx="10" cy="5" r="2.5"/><path d="M10 8v6l-3 7M10 14l3 7M15 9l2 12"/>'),
    user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    brief: sv('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')
  };
  const LOAN = {
    Car: { c: 'var(--c-car)', t: ['Car Loan'] },
    Home: { c: 'var(--c-home)', t: ['Housing Loan', 'Housing Loan Top-up'] },
    CC: { c: 'var(--c-cc)', t: ['Cash Credit', 'Term Loan + Cash Credit'] },
    PL: { c: 'var(--c-pl)', t: ['Personal Loan'] },
    LAP: { c: 'var(--c-lap)', t: ['Loan Against Property'] }
  };
  const loanKey = t => Object.keys(LOAN).find(k => LOAN[k].t.includes(t)) || 'Car';
  const loanColor = t => LOAN[loanKey(t)].c;
  const initials = n => String(n || '?').replace(/\b(dr|md|mr|mrs|ms)\.?\s/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const prioBadge = p => !p ? '' : `<span class="badge ${p[0] === 'A' ? 'b-hot' : p[0] === 'B' ? 'b-warm' : 'b-cold'}">${esc(p.slice(4) || p)}</span>`;
  const segShort = s => ({ 'PSU / Coal (CCL etc.)': 'PSU', 'Business Owner / Trader': 'Business', 'Self-employed Professional': 'Professional', 'Bank / Financial Staff': 'Bank staff', 'Govt Employee': 'Govt', 'Private Salaried': 'Private', 'Other / Student / Homemaker': 'Other' }[s] || s || '');
  const rs = v => has(v) ? 'Rs ' + v : '—';
  function short(n) {
    n = Number(n) || 0;
    if (n >= 1e7) return 'Rs ' + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return 'Rs ' + (n / 1e5).toFixed(1) + ' L';
    return 'Rs ' + Math.round(n).toLocaleString('en-IN');
  }
  function ago(iso) {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function parseDmy(s) { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
  const customers = () => (state.data && state.data.customers) || [];
  const outstanding = c => c.loans.reduce((a, l) => a + num(has(l.cbsOutstanding) ? l.cbsOutstanding : l.outstanding), 0);

  // ---------------------------------------------------------------- API
  async function api(action, body) {
    if (CFG.DEMO_MODE) {
      await new Promise(r => setTimeout(r, 300));
      if (action === 'login') return { ok: true, token: 'demo', user: { username: body.username || 'demo', name: 'Demo user', role: 'Admin' } };
      if (action === 'data') return window.BP_DEMO;
      if (action === 'update') return { ok: true, changed: false, lastSyncAt: new Date().toISOString() };
    }
    if (!CFG.API_URL || CFG.API_URL.indexOf('PASTE_') === 0) throw new Error('The app is not connected yet (API_URL in js/config.js).');
    const res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: state.token }, body || {})) });
    const j = await res.json();
    if (!j.ok && j.error === 'AUTH') { signOut(true); throw new Error(j.message); }
    if (!j.ok) throw new Error(j.message || 'Something went wrong.');
    return j;
  }

  // ---------------------------------------------------------------- sign in
  let pin = '';
  function showLogin(msg) {
    $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
    $('#pinPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map(k =>
      k === 'clr' ? '<button class="txt" data-k="clr">Clear</button>' : k === 'del' ? '<button class="txt" data-k="del">⌫</button>' : `<button data-k="${k}">${k}</button>`).join('');
    pin = ''; drawDots();
    $('#loginMsg').textContent = msg || (CFG.DEMO_MODE ? 'Demo mode: any username and PIN works' : '');
  }
  function drawDots() { $('#pinDots').innerHTML = Array.from({ length: Math.max(4, Math.min(6, pin.length)) }, (_, i) => `<i class="pindot${i < pin.length ? ' on' : ''}"></i>`).join(''); }
  $('#pinPad').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'del') pin = pin.slice(0, -1); else if (k === 'clr') pin = ''; else if (pin.length < 6) pin += k;
    drawDots();
  });
  $('#loginBtn').addEventListener('click', signIn);
  async function signIn() {
    const username = $('#loginUser').value.trim();
    if (!username) { $('#loginMsg').textContent = 'Enter your username.'; return; }
    if (pin.length < 4) { $('#loginMsg').textContent = 'Enter your PIN.'; return; }
    $('#loginMsg').textContent = 'Signing in…';
    try {
      const r = await api('login', { username, pin });
      state.token = r.token; state.user = r.user; set(LS.TOKEN, r.token); set(LS.USER, JSON.stringify(r.user));
      $('#loginMsg').textContent = 'Loading customers…';
      await loadData();
      startApp();
    } catch (err) { pin = ''; drawDots(); $('#loginMsg').textContent = err.message; }
  }
  function signOut(expired) {
    state.token = null; state.user = null; state.data = null;
    set(LS.TOKEN, null); set(LS.USER, null); set(LS.DATA, null);
    closeDetail(true);
    showLogin(expired ? 'Your session ended. Sign in again.' : '');
  }
  async function loadData() {
    const d = await api('data');
    state.data = { lastSyncAt: d.lastSyncAt, customers: d.customers, maps: d.maps, fetchedAt: new Date().toISOString() };
    set(LS.DATA, JSON.stringify(state.data));
  }
  async function update() {
    if (state.busy) return; state.busy = true; $('#fab').classList.add('busy');
    try {
      const u = await api('update');
      await loadData();
      toast(u.changed ? 'Updated with the latest sanction notes' : 'Up to date · data from ' + ago(u.lastSyncAt));
    } catch (err) { toast(err.message); }
    state.busy = false; $('#fab').classList.remove('busy');
    render();
    if (state.detailId) openDetail(state.detailId, true);
  }

  // ---------------------------------------------------------------- shell
  function startApp() {
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    go(state.screen);
    openDeepLink();
  }
  function go(screen) {
    state.screen = screen;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + screen));
    $$('.nav button[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === screen));
    window.scrollTo(0, 0);
    render();
  }
  function render() {
    if (state.screen === 'home') renderHome();
    if (state.screen === 'customers') renderCustomers();
    if (state.screen === 'segments') renderSegments();
    if (state.screen === 'more') renderMore();
  }
  window.addEventListener('scroll', () => { const t = $('.screen.active .topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });
  const avatarHtml = () => `<div class="avatar">${esc(initials((state.user || {}).name || 'U'))}</div>`;

  // ---------------------------------------------------------------- home
  const FIT_TILES = [
    { k: 'Health Insurance', t: 'Health cover', c: '#0f9d58' }, { k: 'Term Plan', t: 'Term plan', c: '#2563eb' }, { k: 'SIP', t: 'SIP', c: '#7c3aed' },
    { k: 'Retirement / Pension Plan', t: 'Retirement', c: '#f59e0b' }, { k: 'NPS', t: 'NPS', c: '#0e7490' }, { k: 'Lumpsum MF / FD', t: 'Lumpsum / FD', c: '#db2777' }
  ];
  function renderHome() {
    const all = customers(), u = state.user || {};
    const loans = all.flatMap(c => c.loans);
    const total = all.reduce((a, c) => a + outstanding(c), 0);
    const hot = all.filter(c => (c.priority || '')[0] === 'A');
    const today = new Date(), in60 = new Date(Date.now() + 60 * 864e5);
    const due = loans.filter(l => { const d = parseDmy(l.anniversary); return d && d >= today && d <= in60; }).length;
    const byType = k => loans.filter(l => loanKey(l.type) === k);
    const hour = today.getHours();
    $('#s-home').innerHTML = `
      <div class="topbar"><div class="grow"><h1>${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${esc(String(u.name || '').split(' ')[0] || 'there')}</h1>
        <div class="sub">${esc(CFG.BRANCH_NAME)} · data from ${esc(ago(state.data && state.data.lastSyncAt))}</div></div>
        <button class="iconbtn" data-act="update" aria-label="Update">${ICON.refresh}</button>${avatarHtml()}</div>
      <div class="hero">
        <div class="label">Outstanding with us</div>
        <div class="value">${esc(short(total))}</div>
        <div class="note">${loans.length} loans · ${all.length} customers</div>
        <div class="hero-row">
          <button class="hero-chip" data-jump="hot"><b>${hot.length}</b><span>Hot leads</span></button>
          <button class="hero-chip" data-jump="multi"><b>${all.filter(c => c.loans.length > 1).length}</b><span>2+ loans</span></button>
          <div class="hero-chip"><b>${due}</b><span>Renewals in 60 days</span></div>
        </div>
      </div>
      <div class="sec"><div class="sec-head"><h2>Loan book</h2></div>
        <div class="split">${['Car', 'Home', 'CC', 'PL'].map(k => { const ls = byType(k); return `<button class="ph" style="--pc:${LOAN[k].c}" data-loanjump="${k}"><b>${ls.length}</b><span>${k === 'PL' ? 'Personal' : k}</span><small>${esc(short(ls.reduce((a, l) => a + num(has(l.cbsOutstanding) ? l.cbsOutstanding : l.outstanding), 0)))}</small></button>`; }).join('')}</div></div>
      <div class="sec"><div class="sec-head"><h2>Strong fits</h2><span class="link" data-go2="segments">By segment</span></div>
        <div class="stats">${FIT_TILES.map(f => `<button class="stat" data-fitjump="${esc(f.k)}"><b>${all.filter(c => (c.fits || {})[f.k] === 'High').length}</b><span><i class="dot" style="background:${f.c}"></i>${esc(f.t)}</span></button>`).join('')}</div></div>
      <div class="sec"><div class="sec-head"><h2>Hot leads</h2><span class="link" data-jump="hot">See all</span></div>
        <div class="list" style="padding:0">${hot.slice(0, 5).map(custCard).join('') || '<div class="empty"><b>No hot leads yet</b></div>'}</div></div>`;
  }

  // ---------------------------------------------------------------- customers
  function filtered() {
    const q = state.q.trim().toLowerCase();
    return customers()
      .filter(c => state.loan === 'All' || (state.loan === 'Multi' ? c.loans.length > 1 : c.loans.some(l => loanKey(l.type) === state.loan)))
      .filter(c => state.prio === 'All' || (c.priority || '')[0] === state.prio)
      .filter(c => !state.fit || (c.fits || {})[state.fit] === 'High')
      .filter(c => !q || [c.name, c.mobile, c.locality, c.district, c.occDetail, c.employer, c.id, ...c.loans.map(l => l.asset), ...c.loans.map(l => l.acctNo)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.priority || 'Z').localeCompare(b.priority || 'Z') || a.name.localeCompare(b.name));
  }
  function custCard(c) {
    const t0 = (c.loans[0] || {}).type;
    const types = [...new Set(c.loans.map(l => loanKey(l.type)))];
    return `<button class="lead" style="--acc:${loanColor(t0)}" data-cust="${esc(c.id)}">
      <div class="ini" style="--acc:${loanColor(t0)}">${esc(initials(c.name))}</div>
      <div class="body">
        <div class="r1"><span class="nm">${esc(c.name)}</span>${prioBadge(c.priority)}</div>
        <div class="meta">${esc([has(c.age) ? c.age + ' yrs' : '', segShort(c.segment), c.locality].filter(Boolean).join(' · '))}</div>
        <div class="r3"><span class="amt">${esc(short(outstanding(c)))}</span>${types.map(k => `<span class="tag-l" style="--lc:${LOAN[k].c}">${k}</span>`).join('')}${c.top3 ? `<span>${esc(String(c.top3).split(';')[0])}</span>` : ''}</div>
      </div></button>`;
  }
  function renderCustomers() {
    const list = filtered();
    const focused = document.activeElement && document.activeElement.id === 'q';
    const chip = (k, t, on, attr, dot) => `<button class="chip${on ? ' on' : ''}" ${attr}="${esc(k)}">${dot ? `<i class="cd" style="background:${dot}"></i>` : ''}${esc(t)}</button>`;
    $('#s-customers').innerHTML = `
      <div class="topbar"><div class="grow"><h1>Customers</h1><div class="sub">${list.length} of ${customers().length}${state.fit ? ' · strong fit: ' + esc(state.fit) : ''}</div></div>
        ${state.fit ? '<button class="chip on" data-clearfit="1">Clear ✕</button>' : ''}</div>
      <div class="searchbar"><div class="search">${ICON.search}<input id="q" type="search" placeholder="Name, mobile, account no., locality" value="${esc(state.q)}" autocomplete="off"></div></div>
      <div class="chips">${chip('All', 'All loans', state.loan === 'All', 'data-loan')}${Object.keys(LOAN).map(k => chip(k, k === 'CC' ? 'Cash credit' : k === 'PL' ? 'Personal' : k, state.loan === k, 'data-loan', LOAN[k].c)).join('')}${chip('Multi', '2+ loans', state.loan === 'Multi', 'data-loan')}</div>
      <div class="chips">${[['All', 'All leads'], ['A', 'Hot'], ['B', 'Warm'], ['C', 'Nurture']].map(([k, t]) => chip(k, t, state.prio === k, 'data-prio')).join('')}</div>
      <div class="list">${list.map(custCard).join('') || '<div class="empty"><b>No customers match</b><p>Try another search or filter.</p></div>'}</div>`;
    if (focused) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; renderCustomers(); } });

  // ---------------------------------------------------------------- profile
  const kv = (k, v) => has(v) ? `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>` : '';
  const kvb = (k, v) => has(v) ? `<div class="kv block"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>` : '';
  const sec = (title, body, foot) => body && body.trim() ? `<div class="sec"><div class="sec-head"><h2>${esc(title)}</h2></div><div class="card">${body}</div>${foot ? `<p class="note">${esc(foot)}</p>` : ''}</div>` : '';
  const split = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
  const fam = (icon, who, text) => has(text) ? `<div class="fam"><div class="vi">${icon}</div><div><b>${esc(who)}</b><span>${esc(text)}</span></div></div>` : '';

  function openDetail(id, refresh) {
    const c = customers().find(x => x.id === id); if (!c) return;
    state.detailId = id;
    const t0 = (c.loans[0] || {}).type;
    const loanSugg = [...new Set(c.loans.flatMap(l => split(l.suggested)))];
    const fits = Object.entries(c.fits || {}).sort((a, b) => (a[1] === 'High' ? 0 : 1) - (b[1] === 'High' ? 0 : 1));
    const talk = String(c.talk || '').split('|').map(s => s.trim()).filter(Boolean);
    const others = [...(c.inLoanCrm || []).map(l => Object.assign({ app: 'Loan CRM' }, l)), ...(c.inCveCrm || []).map(l => Object.assign({ app: 'CVE CRM' }, l))];
    const appOf = n => (CFG.APPS || []).find(a => a.name === n) || {};
    const d = $('#detail');
    d.innerHTML = `
      <div class="fs-head"><button class="iconbtn" data-act="back" aria-label="Back">${ICON.back}</button><h2>${esc(c.name)}</h2>${prioBadge(c.priority)}</div>
      <div class="fs-body">
        <div class="d-hero">
          <div class="ini" style="--acc:${loanColor(t0)}">${esc(initials(c.name))}</div>
          <div style="min-width:0"><p class="nm">${esc(c.name)}</p>
            <div class="mb">${esc([has(c.age) ? c.age + ' yrs' : '', c.stage, segShort(c.segment)].filter(Boolean).join(' · '))}</div>
            <div class="d-badges">${has(c.cibil) && num(c.cibil) > 0 ? `<span class="badge b-brand">CIBIL ${esc(c.cibil)}</span>` : ''}${c.loans.length > 1 ? `<span class="badge b-brand">${c.loans.length} loans</span>` : ''}${has(c.incomeSeg) ? `<span class="badge b-cold">${esc(c.incomeSeg)}</span>` : ''}</div>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi"><span>Income / year</span><b>${esc(rs(c.income))}</b></div>
          <div class="kpi"><span>Net worth</span><b>${has(c.netWorth) ? 'Rs ' + esc(c.netWorth) + ' L' : '—'}</b></div>
          <div class="kpi"><span>Est. surplus / month</span><b>${esc(rs(c.surplus))}</b></div>
          <div class="kpi"><span>Outstanding with us</span><b>${esc(short(outstanding(c)))}</b></div>
        </div>

        ${sec('Profile', kv('Mobile', c.mobile) + kv('Occupation', c.occDetail || c.occ) + kv('Employer / business', c.employer) + kv('Relation', c.relation) + kvb('Address', c.address) + kv('Customer ID', c.id))}

        ${c.loans.length ? `<div class="sec"><div class="sec-head"><h2>Loans with us</h2></div>${c.loans.map(l => `<div class="card">
          <div class="loan-head" style="--lc:${loanColor(l.type)}"><div class="vi">${esc(loanKey(l.type))}</div><div class="t"><b>${esc(l.type)}</b><span>${esc(l.asset || l.scheme || '')}</span></div><div class="a">${esc(rs(l.amount))}</div></div>
          ${kv('Account no.', l.acctNo)}${kv('Sanctioned', l.sanctionDate)}${kv('Rate · tenure', [has(l.roi) ? l.roi + '%' : '', has(l.tenure) ? l.tenure + ' months' : ''].filter(Boolean).join(' · '))}
          ${kv('EMI', has(l.emi) ? rs(l.emi) : '')}${kv('Outstanding', rs(has(l.cbsOutstanding) ? l.cbsOutstanding : l.outstanding))}${kv('Months left', l.remaining)}
          ${kv('Next anniversary', l.anniversary)}${kv('Vehicle no.', l.regNo)}${kv('Dealer', l.dealer)}${kv('Guarantor', l.guarantor)}${kv('Co-applicant', l.coApplicant)}
        </div>`).join('')}</div>` : ''}

        ${loanSugg.length ? sec('Suggested loans and banking', `<div class="pills">${loanSugg.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>`) : ''}

        ${fits.length ? sec('Investment and insurance fit', fits.map(([p, f]) => `<div class="fit"><span>${esc(p)}</span><span class="badge ${f === 'High' ? 'b-high' : 'b-med'}">${esc(f)}</span></div>`).join('') + kv('Suggested SIP', has(c.sip) ? rs(c.sip) + ' / month' : '') + kv('Suggested term cover', has(c.termCover) ? 'Rs ' + c.termCover + ' L' : ''), 'Based on income, age, surplus and family details in the sanction note.') : ''}

        ${talk.length ? sec('Why these products', talk.map(t => { const i = t.indexOf(':'); return `<div class="why"><b>${esc(i > 0 ? t.slice(0, i) : 'Note')}</b><span>${esc(i > 0 ? t.slice(i + 1).trim() : t)}</span></div>`; }).join('')) : ''}

        ${sec('For the family', fam(ICON.heart, 'Spouse', c.forSpouse) + fam(ICON.child, 'Children', c.forChildren) + fam(ICON.elder, 'Parents', c.forParents), 'Family ages are typical for the life stage unless marked "Known".')}

        ${sec('By life stage and job', fam(ICON.user, c.stage || 'Life stage', c.self) + fam(ICON.brief, segShort(c.segment) || 'Employment', c.empProducts))}

        ${sec('What they already have', kv('Marital status', c.marital) + kvb('Spouse', c.spouse) + kvb('Children', c.children) + kv('Dependent parents', c.parents) + kvb('Life cover', c.lifeCover) + kvb('Health cover', c.healthCover) + kvb('Loan-linked cover', c.loanCover) + kvb('Retirement savings', c.retirement) + kvb('Investments', c.investments) + kvb('Gold', c.gold) + kvb('Property', c.realEstate) + kvb('Farm land', c.agri) + kvb('Other income', c.otherIncome) + kvb('Employer benefits', c.benefits))}

        ${sec('In your other apps', others.length ? others.map(o => {
          const url = o.app === 'CVE CRM' ? cveUrl(c) : '';
          const a = appOf(o.app);
          const inner = `<div class="vi" style="background:${esc(a.color || 'var(--brand)')}">${esc(a.glyph || o.app[0])}</div><div class="t"><b>${esc(o.app)} · ${esc(o.product || 'Lead')}</b><span>${esc([o.stage, o.date].filter(Boolean).join(' · '))}${o.amount ? ' · ' + esc(short(o.amount)) : ''}</span></div>`;
          return url ? `<a class="xlink" href="${esc(url)}" target="_blank" rel="noopener">${inner}<span class="arrow">${ICON.chev}</span></a>` : `<div class="xlink">${inner}</div>`;
        }).join('') : '<div class="kv"><span class="k">Not found in Loan CRM or CVE CRM</span></div>', 'Matched by mobile number. Tap a CVE CRM lead to open it.')}

        ${sec('Notes', kvb('From the sanction notes', [c.wealthNotes, ...c.loans.map(l => l.notes)].filter(has).join('\n\n')) + kvb('Other loans / liabilities', c.loans.map(l => l.existingLoans).filter(has).join('; ')) + kvb('Household', c.household))}

        ${sec('Source', kv('Data confidence', c.confidence) + c.loans.map(l => kvb('Sanction note', l.source)).join(''))}
      </div>`;
    if (!refresh) {
      d.scrollTop = 0;
      requestAnimationFrame(() => d.classList.add('on'));
      history.pushState({ detail: id }, '');
    }
  }
  function closeDetail(silent) {
    const d = $('#detail'); if (!d.classList.contains('on')) return;
    d.classList.remove('on'); state.detailId = null;
    if (!silent && history.state && history.state.detail) history.back();
  }
  window.addEventListener('popstate', () => { if ($('#detail').classList.contains('on')) { $('#detail').classList.remove('on'); state.detailId = null; } });

  // Link to this customer's lead in CVE CRM, matched by mobile
  function cveUrl(c) {
    const app = (CFG.APPS || []).find(a => a.name === 'CVE CRM');
    const mob = String(c.mobile || '').replace(/\D/g, '').slice(-10);
    return app && mob.length === 10 ? app.url + '?mobile=' + mob : '';
  }
  // Links from other apps: ?mobile=<number>, ?cid=<customer id> or ?q=<name>
  const deepLink = (() => {
    const p = new URLSearchParams(location.search);
    return { mobile: String(p.get('mobile') || '').replace(/\D/g, '').slice(-10), cid: p.get('cid') || '', q: p.get('q') || '' };
  })();
  function openDeepLink() {
    const { mobile, cid, q } = deepLink;
    if (!mobile && !cid && !q) return;
    deepLink.mobile = deepLink.cid = deepLink.q = '';
    try { history.replaceState(null, '', location.pathname + (CFG.DEMO_MODE ? '?demo=1' : '')); } catch (e) {}
    const all = customers();
    let hits = mobile ? all.filter(c => String(c.mobile || '').replace(/\D/g, '').slice(-10) === mobile) : [];
    if (!hits.length && cid) hits = all.filter(c => c.id === cid);
    if (!hits.length && q) hits = all.filter(c => String(c.name || '').trim().toLowerCase() === q.trim().toLowerCase());
    if (hits.length === 1) { openDetail(hits[0].id); return; }
    state.q = hits.length ? (mobile || q) : '';
    go('customers');
    if (!hits.length) toast('No borrower profile for this customer');
  }

  // ---------------------------------------------------------------- segments
  function renderSegments() {
    const all = customers(), maps = (state.data && state.data.maps) || { age: [], employment: [] };
    const isAge = state.segMode === 'age';
    const COL = ['#7c3aed', '#2563eb', '#0f9d58', '#f59e0b', '#db2777', '#0e7490', '#64748b', '#a855f7', '#ef4444'];
    if (state.segOpen) {
      const m = (isAge ? maps.age : maps.employment).find(x => (isAge ? x['Life Stage'] : x['Employment Segment']) === state.segOpen) || {};
      const list = all.filter(c => (isAge ? c.stage : c.segment) === state.segOpen).sort((a, b) => (a.priority || 'Z').localeCompare(b.priority || 'Z'));
      const body = isAge
        ? kvb('Typical needs', m['Typical Needs']) + kvb('Investment', m['Self – Investment']) + kvb('Insurance', m['Self – Insurance']) + kvb('Loans', m['Self – Loans']) + kvb('For spouse', m['For Spouse']) + kvb('For children (' + (m['Children (typical age)'] || '') + ')', m['For Children']) + kvb('For parents (' + (m['Parents (typical age)'] || '') + ')', m['For Parents'])
        : kvb('Profile and needs', m['Profile & Needs']) + kvb('Investment', m['Investment']) + kvb('Insurance', m['Insurance']) + kvb('Loans and banking', m['Loans & Banking']) + kvb('Best pitch', m['Best Pitch Angle']) + kvb('Avoid', m['Avoid / Note']);
      $('#s-segments').innerHTML = `
        <div class="topbar"><button class="iconbtn" data-act="segback" aria-label="Back">${ICON.back}</button><div class="grow"><h1>${esc(state.segOpen)}</h1><div class="sub">${list.length} customers</div></div></div>
        ${sec('What suits this segment', body)}
        <div class="sec"><div class="sec-head"><h2>Customers</h2></div><div class="list" style="padding:0">${list.map(custCard).join('') || '<div class="empty"><b>No customers in this segment yet</b></div>'}</div></div>`;
      return;
    }
    const rows = isAge
      ? maps.age.map(m => ({ k: m['Life Stage'], sub: m['Age From'] + (num(m['Age To']) > 100 ? '+' : '–' + m['Age To']) + ' yrs · ' + String(m['Self – Investment'] || '').split(';')[0], n: all.filter(c => c.stage === m['Life Stage']).length }))
      : maps.employment.map(m => ({ k: m['Employment Segment'], sub: m['Best Pitch Angle'] || '', n: all.filter(c => c.segment === m['Employment Segment']).length }));
    $('#s-segments').innerHTML = `
      <div class="topbar"><div class="grow"><h1>Segments</h1><div class="sub">What suits each group, and who is in it</div></div></div>
      <div class="segment"><button class="${isAge ? 'on' : ''}" data-segmode="age">By age</button><button class="${!isAge ? 'on' : ''}" data-segmode="employment">By job</button></div>
      <div class="sec"><div class="vcards">${rows.map((r, i) => `<button class="vcard" data-segopen="${esc(r.k)}"><div class="vi" style="background:${COL[i % COL.length]}">${esc(initials(segShort(r.k) || r.k))}</div><div class="vt"><b>${esc(r.k)}</b><span>${esc(r.sub)}</span></div><div class="vn"><b>${r.n}</b><span>customers</span></div></button>`).join('')}</div></div>`;
  }

  // ---------------------------------------------------------------- more
  function renderMore() {
    const u = state.user || {}, dark = document.documentElement.dataset.theme === 'dark';
    const row = (k, ic, t, s, tail, href) => {
      const inner = `<div class="ic">${ic}</div><div class="tx"><b>${esc(t)}</b><span>${esc(s)}</span></div>${tail || `<span class="arrow">${ICON.chev}</span>`}`;
      return href ? `<a class="listrow" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : `<button class="listrow" data-more="${k}">${inner}</button>`;
    };
    $('#s-more').innerHTML = `
      <div class="topbar"><h1>More</h1></div>
      <div class="sec"><div class="card pad" style="display:flex;align-items:center;gap:14px">
        <div class="avatar" style="width:50px;height:50px;font-size:18px">${esc(initials(u.name || 'U'))}</div>
        <div style="flex:1"><div style="font-size:17px;font-weight:700">${esc(u.name || '—')}</div><div style="font-size:13px;color:var(--text-2)">${esc((u.role || '') + ' · @' + (u.username || ''))}</div></div>
      </div></div>
      <div class="sec">
        ${row('update', ICON.refresh, 'Update now', 'Data from ' + ago(state.data && state.data.lastSyncAt) + ' · ' + customers().length + ' customers')}
        ${(CFG.APPS || []).map(a => row('', `<span style="color:${esc(a.color)}">${esc(a.glyph)}</span>`, a.name, a.desc, '', a.url)).join('')}
        ${row('', ICON.sheet, 'Open Google Sheet', 'Borrower Profiles (Live)', '', CFG.SHEET_URL)}
        ${row('theme', ICON.moon, 'Dark mode', dark ? 'On' : 'Follows your phone', `<span class="switch${dark ? ' on' : ''}"></span>`)}
        ${row('signout', ICON.out, 'Sign out', 'Removes customer data from this phone')}
      </div>
      <p class="ver">${esc(CFG.APP_NAME)} v${esc(CFG.VERSION)}${CFG.DEMO_MODE ? ' · demo data' : ''}</p>`;
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', e => {
    const t = e.target;
    const nav = t.closest('[data-go]'); if (nav) { if (nav.dataset.go === 'segments' && state.screen === 'segments') state.segOpen = null; go(nav.dataset.go); return; }
    const g2 = t.closest('[data-go2]'); if (g2) { state.segOpen = null; go(g2.dataset.go2); return; }
    const a = t.closest('[data-act]');
    if (a) {
      const k = a.dataset.act;
      if (k === 'update') update();
      if (k === 'back') closeDetail();
      if (k === 'segback') { state.segOpen = null; renderSegments(); }
      return;
    }
    const cust = t.closest('[data-cust]'); if (cust) { openDetail(cust.dataset.cust); return; }
    const lc = t.closest('[data-loan]'); if (lc) { state.loan = lc.dataset.loan; renderCustomers(); return; }
    const pc = t.closest('[data-prio]'); if (pc) { state.prio = pc.dataset.prio; renderCustomers(); return; }
    const cf = t.closest('[data-clearfit]'); if (cf) { state.fit = null; renderCustomers(); return; }
    const j = t.closest('[data-jump]'); if (j) { state.q = ''; state.fit = null; state.loan = j.dataset.jump === 'multi' ? 'Multi' : 'All'; state.prio = j.dataset.jump === 'hot' ? 'A' : 'All'; go('customers'); return; }
    const lj = t.closest('[data-loanjump]'); if (lj) { state.q = ''; state.fit = null; state.prio = 'All'; state.loan = lj.dataset.loanjump; go('customers'); return; }
    const fj = t.closest('[data-fitjump]'); if (fj) { state.q = ''; state.loan = 'All'; state.prio = 'All'; state.fit = fj.dataset.fitjump; go('customers'); return; }
    const sm = t.closest('[data-segmode]'); if (sm) { state.segMode = sm.dataset.segmode; state.segOpen = null; renderSegments(); return; }
    const so = t.closest('[data-segopen]'); if (so) { state.segOpen = so.dataset.segopen; renderSegments(); window.scrollTo(0, 0); return; }
    const m = t.closest('[data-more]');
    if (m) {
      if (m.dataset.more === 'update') update();
      if (m.dataset.more === 'signout') signOut(false);
      if (m.dataset.more === 'theme') {
        const dark = document.documentElement.dataset.theme === 'dark';
        document.documentElement.dataset.theme = dark ? 'light' : 'dark';
        set(LS.THEME, dark ? 'light' : 'dark');
        renderMore();
      }
    }
  });

  // ---------------------------------------------------------------- start
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (CFG.DEMO_MODE) { state.token = 'demo'; state.user = { username: 'demo', name: 'Demo user', role: 'Admin' }; loadData().then(startApp); }
  else if (state.token && state.data) startApp();
  else showLogin();
})();
