/* Borrower Profiles — view-only customer profiles, iPhone style */
(function () {
  'use strict';
  const CFG = window.BP_CONFIG;
  const LS = { TOKEN: 'bp_token', USER: 'bp_user', DATA: 'bp_data' };
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = s => Number(String(s == null ? '' : s).replace(/[^\d.-]/g, '')) || 0;
  const has = v => v != null && String(v).trim() !== '' && String(v).trim() !== '-';

  const state = {
    token: get(LS.TOKEN), user: getJson(LS.USER), data: getJson(LS.DATA),
    tab: 'customers', q: '', loanFilter: 'All', prioFilter: 'All', segMode: 'age', segOpen: null, detailId: null, busy: false
  };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function getJson(k) { try { return JSON.parse(get(k) || 'null'); } catch (e) { return null; } }

  // ---------------------------------------------------------------- icons
  const I = {
    chev: '<svg class="chev" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sheet: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
  };
  const COLORS = ['#ff9500', '#34c759', '#5856d6', '#ff2d55', '#30b0c7', '#007aff', '#af52de', '#a2845e'];
  const colorFor = s => COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const prioBadge = p => !p ? '' : `<span class="badge ${p[0] === 'A' ? 'b-hot' : p[0] === 'B' ? 'b-warm' : 'b-cold'}">${esc(p.slice(4) || p)}</span>`;
  const fitBadge = f => `<span class="badge ${f === 'High' ? 'b-high' : 'b-med'}">${esc(f)}</span>`;
  const segShort = s => ({ 'PSU / Coal (CCL etc.)': 'PSU', 'Business Owner / Trader': 'Business', 'Self-employed Professional': 'Professional', 'Bank / Financial Staff': 'Bank staff', 'Govt Employee': 'Govt', 'Private Salaried': 'Private', 'Other / Student / Homemaker': 'Other' }[s] || s || '');
  const loanShort = t => ({ 'Car Loan': 'Car', 'Housing Loan': 'Home', 'Housing Loan Top-up': 'Home top-up', 'Cash Credit': 'CC', 'Personal Loan': 'PL', 'Loan Against Property': 'LAP', 'Term Loan + Cash Credit': 'CC' }[t] || t);
  const rs = v => has(v) ? 'Rs ' + v : '—';
  function ago(iso) {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }

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
    $('#lMsg').textContent = msg || '';
    $('#lPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'go', '0', 'del'].map(k =>
      k === 'go' ? '<button class="txt" data-k="go">Sign in</button>' : k === 'del' ? '<button class="txt" data-k="del">Delete</button>' : `<button data-k="${k}">${k}</button>`).join('');
    pin = ''; drawDots();
    if (CFG.DEMO_MODE) $('#lMsg').textContent = 'Demo mode: any username and PIN works';
  }
  function drawDots() { $('#lDots').innerHTML = Array.from({ length: Math.max(4, Math.min(6, pin.length)) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); }
  $('#lPad').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'go') return signIn();
    else if (pin.length < 6) pin += k;
    drawDots();
  });
  async function signIn() {
    const username = $('#lUser').value.trim();
    if (!username) { $('#lMsg').textContent = 'Enter your username.'; return; }
    if (pin.length < 4) { $('#lMsg').textContent = 'Enter your PIN.'; return; }
    $('#lMsg').textContent = 'Signing in…';
    try {
      const r = await api('login', { username, pin });
      state.token = r.token; state.user = r.user; set(LS.TOKEN, r.token); set(LS.USER, JSON.stringify(r.user));
      $('#lMsg').textContent = 'Loading customers…';
      await loadData();
      startApp();
    } catch (err) { pin = ''; drawDots(); $('#lMsg').textContent = err.message; }
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
    if (state.busy) return; state.busy = true; renderTab();
    try {
      const u = await api('update');
      await loadData();
      toast(u.changed ? 'Updated with the latest sanction notes' : 'Up to date · data from ' + ago(u.lastSyncAt));
    } catch (err) { toast(err.message); }
    state.busy = false; renderTab();
    if (state.detailId) openDetail(state.detailId, true);
  }

  // ---------------------------------------------------------------- shell
  function startApp() {
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    renderTab();
  }
  $('#tabbar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (state.tab === b.dataset.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); state.segOpen = null; }
    state.tab = b.dataset.tab;
    $$('#tabbar button').forEach(x => x.classList.toggle('on', x === b));
    $$('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + state.tab));
    window.scrollTo(0, 0); renderTab();
  });
  window.addEventListener('scroll', () => { const n = $('#tab-' + state.tab + ' .navbar'); if (n) n.classList.toggle('scrolled', window.scrollY > 34); }, { passive: true });

  function navbar(title, left, right) {
    return `<div class="navbar"><div>${left || ''}</div><div class="small-title">${esc(title)}</div><div>${right || ''}</div></div>`;
  }
  const updateBtn = () => `<button class="nav-btn" data-act="update" aria-label="Update">${state.busy ? '<span class="spin" style="display:inline-flex">' + I.refresh + '</span>' : I.refresh}</button>`;

  function renderTab() {
    if (state.tab === 'customers') renderCustomers();
    if (state.tab === 'segments') renderSegments();
    if (state.tab === 'apps') renderApps();
    if (state.tab === 'settings') renderSettings();
  }

  // ---------------------------------------------------------------- customers
  const LOAN_FILTERS = ['All', 'Car', 'Home', 'CC', 'PL'];
  function matchesLoan(c, f) { return f === 'All' || c.loans.some(l => { const s = loanShort(l.type); return f === 'Home' ? /Home|LAP/.test(s) : s === f; }); }
  function filtered(list) {
    const q = state.q.trim().toLowerCase();
    return list.filter(c => matchesLoan(c, state.loanFilter))
      .filter(c => state.prioFilter === 'All' || (c.priority || '')[0] === state.prioFilter)
      .filter(c => !q || [c.name, c.mobile, c.locality, c.district, c.occDetail, c.employer, c.id, ...c.loans.map(l => l.asset)].join(' ').toLowerCase().includes(q));
  }
  function sortCust(list) { return list.slice().sort((a, b) => (a.priority || 'Z').localeCompare(b.priority || 'Z') || a.name.localeCompare(b.name)); }
  function custRow(c) {
    const types = [...new Set(c.loans.map(l => loanShort(l.type)))].join(', ');
    return `<button class="row tap" data-cust="${esc(c.id)}">
      <div class="avatar" style="background:${colorFor(c.name)}">${esc(initials(c.name))}</div>
      <div class="title"><b>${esc(c.name)}</b><span>${esc([c.age, segShort(c.segment), types].filter(Boolean).join(' · '))}</span></div>
      ${prioBadge(c.priority)}${I.chev}</button>`;
  }
  function renderCustomers() {
    const el = $('#tab-customers');
    const all = (state.data && state.data.customers) || [];
    const list = sortCust(filtered(all));
    const loans = all.reduce((a, c) => a + c.loans.length, 0);
    const hot = all.filter(c => (c.priority || '')[0] === 'A').length;
    const keepFocus = document.activeElement && document.activeElement.id === 'q';
    el.innerHTML = navbar('Customers', '', updateBtn()) + `
      <div class="large-title">Customers</div>
      <div class="subhead">${esc(CFG.BRANCH_NAME)} · data from ${esc(ago(state.data && state.data.lastSyncAt))}</div>
      <div class="tiles">
        <div class="tile"><span>Customers</span><b>${all.length}</b></div>
        <div class="tile"><span>Loans</span><b>${loans}</b></div>
        <div class="tile"><span>Hot leads</span><b>${hot}</b></div>
      </div>
      <div class="search">${I.search}<input id="q" type="search" placeholder="Name, mobile, firm, locality" value="${esc(state.q)}" autocomplete="off"></div>
      <div class="seg" id="loanSeg">${LOAN_FILTERS.map(f => `<button class="${f === state.loanFilter ? 'on' : ''}" data-f="${f}">${f}</button>`).join('')}</div>
      <div class="chips" id="prioChips">${[['All', 'All leads'], ['A', 'Hot'], ['B', 'Warm'], ['C', 'Nurture']].map(([k, t]) => `<button class="chip ${k === state.prioFilter ? 'on' : ''}" data-p="${k}">${t}</button>`).join('')}</div>
      <div class="list-count">${list.length} ${list.length === 1 ? 'customer' : 'customers'}</div>
      ${list.length ? `<div class="group">${list.map(custRow).join('')}</div>` : '<div class="empty">No customers match. Try another search or filter.</div>'}`;
    if (keepFocus) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; renderCustomers(); } });
  document.addEventListener('click', e => {
    const f = e.target.closest('#loanSeg button'); if (f) { state.loanFilter = f.dataset.f; renderCustomers(); return; }
    const p = e.target.closest('#prioChips button'); if (p) { state.prioFilter = p.dataset.p; renderCustomers(); return; }
    const c = e.target.closest('[data-cust]'); if (c) { openDetail(c.dataset.cust); return; }
    const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act, a);
  });

  // ---------------------------------------------------------------- detail
  function kv(k, v) { return has(v) ? `<div class="row"><div class="title"><b>${esc(k)}</b></div><div class="value">${esc(v)}</div></div>` : ''; }
  function stack(k, v) { return has(v) ? `<div class="row stack"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : ''; }
  function section(title, body, foot) { return body && body.trim() ? `<div class="section-h">${esc(title)}</div><div class="group">${body}</div>${foot ? `<div class="section-f">${esc(foot)}</div>` : ''}` : ''; }
  function splitList(s) { return String(s || '').split(';').map(x => x.trim()).filter(Boolean); }

  function openDetail(id, refresh) {
    const c = ((state.data && state.data.customers) || []).find(x => x.id === id); if (!c) return;
    state.detailId = id;
    const d = $('#detail');
    const loanSugg = [...new Set(c.loans.flatMap(l => splitList(l.suggested)))];
    const fits = Object.entries(c.fits || {}).sort((a, b) => (a[1] === 'High' ? 0 : 1) - (b[1] === 'High' ? 0 : 1));
    const talk = String(c.talk || '').split('|').map(s => s.trim()).filter(Boolean);
    const others = [...(c.inLoanCrm || []).map(l => Object.assign({ app: 'Loan CRM' }, l)), ...(c.inCveCrm || []).map(l => Object.assign({ app: 'CVE CRM' }, l))];
    d.innerHTML = `<div class="inner">
      ${navbar(c.name, `<button class="nav-btn" data-act="back">${I.back}<span>Customers</span></button>`, '')}
      <div class="hero">
        <div class="avatar" style="background:${colorFor(c.name)}">${esc(initials(c.name))}</div>
        <h2>${esc(c.name)}</h2>
        <p>${esc([has(c.age) ? c.age + ' yrs' : '', c.stage, segShort(c.segment)].filter(Boolean).join(' · '))}</p>
        <div class="badges">${prioBadge(c.priority)}${has(c.cibilBand) ? `<span class="badge b-blue">CIBIL ${esc(c.cibil)}</span>` : ''}${c.loans.length > 1 ? `<span class="badge b-blue">${c.loans.length} loans</span>` : ''}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Income / year</span><b>${esc(rs(c.income))}</b></div>
        <div class="kpi"><span>Net worth</span><b>${has(c.netWorth) ? 'Rs ' + esc(c.netWorth) + ' L' : '—'}</b></div>
        <div class="kpi"><span>Est. surplus / month</span><b>${esc(rs(c.surplus))}</b></div>
        <div class="kpi"><span>Outstanding with us</span><b>${esc(rs(c.outstanding))}</b></div>
      </div>

      ${section('Profile', kv('Mobile', c.mobile) + kv('Occupation', c.occDetail || c.occ) + kv('Employer / business', c.employer) + kv('Relation', c.relation) + stack('Address', c.address) + kv('Income segment', c.incomeSeg) + kv('Customer ID', c.id))}

      ${c.loans.map((l, i) => section(i === 0 ? 'Loans with us' : '', `
        <div class="row"><div class="title"><b>${esc(l.type)}</b><span>${esc(l.asset || '')}</span></div><div class="value">${esc(rs(l.amount))}</div></div>
        ${kv('Sanctioned', l.sanctionDate)}${kv('Rate · tenure', [has(l.roi) ? l.roi + '%' : '', has(l.tenure) ? l.tenure + ' months' : ''].filter(Boolean).join(' · '))}
        ${kv('EMI', rs(l.emi))}${kv('Est. outstanding', rs(l.outstanding))}${kv('Months left', l.remaining)}
        ${kv('Next anniversary', l.anniversary)}${kv('Vehicle no.', l.regNo)}${kv('Dealer', l.dealer)}${kv('Guarantor', l.guarantor)}${kv('Co-applicant', l.coApplicant)}`)).join('')}

      ${loanSugg.length ? section('Suggested loans and banking', `<div class="row stack"><div class="pills">${loanSugg.map(s => `<span class="badge b-blue">${esc(s)}</span>`).join('')}</div>${has(c.loans[0] && c.loans[0].pitch) ? `<div class="k" style="margin-top:6px">${esc(c.loans[0].pitch)}</div>` : ''}</div>`) : ''}

      ${fits.length ? section('Investment and insurance fit', fits.map(([p, f]) => `<div class="row"><div class="title"><b>${esc(p)}</b></div>${fitBadge(f)}</div>`).join('') + kv('Suggested SIP', rs(c.sip) + (has(c.sip) ? ' / month' : '')) + kv('Suggested term cover', has(c.termCover) ? 'Rs ' + c.termCover + ' L' : ''), 'Based on income, age, surplus and family details in the sanction note.') : ''}

      ${talk.length ? section('Why these products', talk.map(t => { const i = t.indexOf(':'); return stack(i > 0 ? t.slice(0, i) : 'Note', i > 0 ? t.slice(i + 1).trim() : t); }).join('')) : ''}

      ${section('For the family', stack('Spouse', c.forSpouse) + stack('Children', c.forChildren) + stack('Parents', c.forParents), 'Family ages are typical for the life stage unless marked "Known".')}

      ${section('By life stage and job', stack('For ' + (c.stage || 'this stage').toLowerCase(), c.self) + stack(segShort(c.segment) || 'Employment', c.empProducts))}

      ${section('What they already have', kv('Marital status', c.marital) + stack('Spouse', c.spouse) + stack('Children', c.children) + kv('Dependent parents', c.parents) + stack('Life cover', c.lifeCover) + stack('Health cover', c.healthCover) + stack('Loan-linked cover', c.loanCover) + stack('Retirement savings', c.retirement) + stack('Investments', c.investments) + stack('Gold', c.gold) + stack('Property', c.realEstate) + stack('Farm land', c.agri) + stack('Other income', c.otherIncome) + stack('Employer benefits', c.benefits))}

      ${section('In your other apps', others.length ? others.map(o => `<div class="row"><div class="title"><b>${esc(o.app)} · ${esc(o.product || 'Lead')}</b><span>${esc([o.stage, o.date].filter(Boolean).join(' · '))}</span></div>${o.amount ? `<div class="value">Rs ${esc(Number(o.amount).toLocaleString('en-IN'))}</div>` : ''}</div>`).join('') : '<div class="row"><div class="title"><span style="margin:0">Not found in Loan CRM or CVE CRM</span></div></div>', 'Matched by mobile number.')}

      ${section('Notes', stack('From the sanction notes', [c.wealthNotes, ...c.loans.map(l => l.notes)].filter(has).join('\n\n')) + stack('Other loans / liabilities', c.loans.map(l => l.existingLoans).filter(has).join('; ')) + stack('Household', c.household))}

      ${section('Source', kv('Data confidence', c.confidence) + c.loans.map(l => stack('Sanction note', l.source)).join(''))}
    </div>`;
    if (!refresh) {
      d.scrollTop = 0;
      requestAnimationFrame(() => d.classList.add('open'));
      history.pushState({ detail: id }, '');
    }
    d.onscroll = () => { const n = $('.navbar', d); if (n) n.classList.toggle('scrolled', d.scrollTop > 120); };
  }
  function closeDetail(silent) {
    const d = $('#detail'); if (!d.classList.contains('open')) return;
    d.classList.remove('open'); state.detailId = null;
    if (!silent && history.state && history.state.detail) history.back();
  }
  window.addEventListener('popstate', () => { if ($('#detail').classList.contains('open')) { $('#detail').classList.remove('open'); state.detailId = null; } });

  // ---------------------------------------------------------------- segments
  function renderSegments() {
    const el = $('#tab-segments');
    const all = (state.data && state.data.customers) || [];
    const maps = (state.data && state.data.maps) || { age: [], employment: [] };
    if (state.segOpen) return renderSegment(el, all, maps);
    const isAge = state.segMode === 'age';
    const rows = isAge
      ? maps.age.map(m => ({ key: m['Life Stage'], sub: m['Age From'] + (num(m['Age To']) > 100 ? '+' : '–' + m['Age To']) + ' · ' + (m['Self – Investment'] || '').split(';')[0], n: all.filter(c => c.stage === m['Life Stage']).length }))
      : maps.employment.map(m => ({ key: m['Employment Segment'], sub: (m['Best Pitch Angle'] || ''), n: all.filter(c => c.segment === m['Employment Segment']).length }));
    el.innerHTML = navbar('Segments', '', '') + `
      <div class="large-title">Segments</div>
      <div class="seg" id="segMode"><button class="${isAge ? 'on' : ''}" data-m="age">By age</button><button class="${!isAge ? 'on' : ''}" data-m="employment">By job</button></div>
      <div class="group">${rows.map(r => `<button class="row tap" data-segopen="${esc(r.key)}"><div class="title"><b>${esc(r.key)}</b><span>${esc(r.sub)}</span></div><div class="value">${r.n}</div>${I.chev}</button>`).join('')}</div>
      <div class="section-f">Tap a segment to see what suits it and who is in it.</div>`;
  }
  function renderSegment(el, all, maps) {
    const isAge = state.segMode === 'age';
    const m = (isAge ? maps.age : maps.employment).find(x => (isAge ? x['Life Stage'] : x['Employment Segment']) === state.segOpen) || {};
    const list = sortCust(all.filter(c => (isAge ? c.stage : c.segment) === state.segOpen));
    const card = isAge
      ? stack('Typical needs', m['Typical Needs']) + stack('Investment', m['Self – Investment']) + stack('Insurance', m['Self – Insurance']) + stack('Loans', m['Self – Loans']) + stack('For spouse', m['For Spouse']) + stack('For children (' + (m['Children (typical age)'] || '') + ')', m['For Children']) + stack('For parents (' + (m['Parents (typical age)'] || '') + ')', m['For Parents'])
      : stack('Profile and needs', m['Profile & Needs']) + stack('Investment', m['Investment']) + stack('Insurance', m['Insurance']) + stack('Loans and banking', m['Loans & Banking']) + stack('Best pitch', m['Best Pitch Angle']) + stack('Avoid', m['Avoid / Note']);
    el.innerHTML = navbar(state.segOpen, `<button class="nav-btn" data-act="segback">${I.back}<span>Segments</span></button>`, '') + `
      <div class="large-title">${esc(state.segOpen)}</div>
      ${section('What suits this segment', card)}
      <div class="section-h">${list.length} ${list.length === 1 ? 'customer' : 'customers'}</div>
      ${list.length ? `<div class="group">${list.map(custRow).join('')}</div>` : '<div class="empty">No customers in this segment yet.</div>'}`;
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const m = e.target.closest('#segMode button'); if (m) { state.segMode = m.dataset.m; renderSegments(); return; }
    const s = e.target.closest('[data-segopen]'); if (s) { state.segOpen = s.dataset.segopen; renderSegments(); }
  });

  // ---------------------------------------------------------------- apps
  function renderApps() {
    const el = $('#tab-apps');
    el.innerHTML = navbar('Apps', '', '') + `
      <div class="large-title">Apps</div>
      <div class="subhead">Your other branch apps</div>
      <div class="group">
        ${CFG.APPS.map(a => `<a class="row tap with-icon" href="${esc(a.url)}" target="_blank" rel="noopener"><div class="icon-sq" style="background:${esc(a.color)}">${esc(a.glyph)}</div><div class="title"><b style="color:var(--label)">${esc(a.name)}</b><span>${esc(a.desc)}</span></div>${I.chev}</a>`).join('')}
      </div>
      <div class="section-f">Customer profiles show any matching leads from these apps, matched by mobile number.</div>
      <div class="section-h">Data</div>
      <div class="group">
        <a class="row tap with-icon" href="${esc(CFG.SHEET_URL)}" target="_blank" rel="noopener"><div class="icon-sq" style="background:#34c759">${I.sheet}</div><div class="title"><b style="color:var(--label)">Google Sheet</b><span>Borrower Profiles (Live)</span></div>${I.chev}</a>
      </div>`;
  }

  // ---------------------------------------------------------------- settings
  function renderSettings() {
    const el = $('#tab-settings'); const u = state.user || {};
    el.innerHTML = navbar('Settings', '', '') + `
      <div class="large-title">Settings</div>
      <div class="group"><div class="row with-icon"><div class="avatar" style="background:${colorFor(u.name || 'x')}">${esc(initials(u.name))}</div><div class="title"><b>${esc(u.name || '—')}</b><span>${esc((u.role || '') + ' · @' + (u.username || ''))}</span></div></div></div>
      <div class="section-h">Data</div>
      <div class="group">
        ${kv('Customers', String(((state.data && state.data.customers) || []).length))}
        ${kv('Sheet last updated', ago(state.data && state.data.lastSyncAt))}
        <button class="row tap" data-act="update"><div class="title"><b style="color:var(--tint)">${state.busy ? 'Updating…' : 'Update now'}</b></div></button>
      </div>
      <div class="section-f">Update pulls in the newest Excel file from Google Drive. New sanction notes are added to that file when you ask Claude to update the borrower profiles.</div>
      <div class="section-h">This phone</div>
      <div class="group">
        <button class="row tap" data-act="signout"><div class="title"><b style="color:var(--red)">Sign out and remove data</b></div></button>
      </div>
      <div class="section-f">Customer data is kept on this phone only while you are signed in.</div>
      <div class="section-f" style="text-align:center;margin-top:28px">${esc(CFG.APP_NAME)} v${esc(CFG.VERSION)}${CFG.DEMO_MODE ? ' · demo data' : ''}</div>`;
  }

  // ---------------------------------------------------------------- actions
  function act(a) {
    if (a === 'update') update();
    if (a === 'back') closeDetail();
    if (a === 'segback') { state.segOpen = null; renderSegments(); }
    if (a === 'signout') signOut(false);
  }
  $('#detail').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) { e.stopPropagation(); act(a.dataset.act); } });

  // ---------------------------------------------------------------- start
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (CFG.DEMO_MODE && !state.token) { state.token = 'demo'; state.user = { username: 'demo', name: 'Demo user', role: 'Admin' }; state.data = null; }
  if (state.token && state.data && !CFG.DEMO_MODE) startApp();
  else if (CFG.DEMO_MODE) { loadData().then(startApp); }
  else showLogin();
})();
