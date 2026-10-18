/**
 * Borrower Profiles – sync + app API
 *
 * One Apps Script project does two jobs:
 *   1. Sync: whenever "Borrower Profiles - Marketing.xlsx" changes in the Drive folder
 *      "CRM Borrower Profiles", it replaces the contents of the Google Sheet
 *      "Borrower Profiles (Live)" (same file, same link).
 *   2. API for the Borrower Profiles app (GitHub Pages). Sign-in uses your Loan CRM
 *      username and PIN; the app never stores data in GitHub.
 *
 * Needs the Drive API advanced service (Services + → Drive API).
 * Deploy → Web app → Execute as: Me, Who has access: Anyone.
 */

// ============================================================ CONFIG
var CFG = {
  FOLDER_NAME: 'CRM Borrower Profiles',
  XLSX_NAME: 'Borrower Profiles - Marketing.xlsx',
  SHEET_TITLE: 'Borrower Profiles (Live)',
  CHECK_EVERY_MINUTES: 15,       // 1, 5, 10, 15 or 30
  EMAIL_ON_ERROR: true,

  // Sign-in is checked by the Loan CRM API, so the same username and PIN work here.
  LOAN_CRM_API: 'https://script.google.com/macros/s/AKfycbxS1pW66sPKOIj7QJivS-_p0UYyYkQ7MSbBHzZO1s38AN7rlpsRD_UBR9U3IkaFY8-Y/exec',
  ALLOWED_ROLES: ['Admin'],      // add 'Staff' to let staff logins see profiles
  TOKEN_TTL_DAYS: 30,

  // Read-only look-ups: is this customer already a lead in the other apps?
  LOAN_CRM_SHEET_ID: '1Q5o8u2aVCYHx-rIdjCxK7upGORchQ2mBDW_6gZD5im8',
  CVE_CRM_SHEET_ID: '1IKFbi7XBCh_pyp4Nt46RjpewDLs06DdIT5NhW13uKIc'
};

var PROPS = PropertiesService.getScriptProperties();

// ============================================================ SYNC
/** Run once: creates the Google Sheet from the Excel file and turns on the auto-check. */
function setup() {
  var xlsx = findXlsx_();
  var sheetId = PROPS.getProperty('SHEET_ID');
  if (!sheetId || !exists_(sheetId)) {
    sheetId = convertNew_(xlsx, getFolder_());
    PROPS.setProperty('SHEET_ID', sheetId);
    PROPS.setProperty('LAST_SYNC_SOURCE_TIME', String(xlsx.getLastUpdated().getTime()));
    PROPS.setProperty('LAST_SYNC_AT', new Date().toISOString());
  }
  if (!PROPS.getProperty('SECRET')) PROPS.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncIfChanged'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncIfChanged').timeBased().everyMinutes(CFG.CHECK_EVERY_MINUTES).create();
  // Touch the other apps' sheets so Google asks for access to them now, not on first use.
  [CFG.LOAN_CRM_SHEET_ID, CFG.CVE_CRM_SHEET_ID].forEach(function (id) {
    try { SpreadsheetApp.openById(id).getName(); } catch (e) { Logger.log('Cannot open ' + id + ': ' + e); }
  });
  Logger.log('Google Sheet: https://docs.google.com/spreadsheets/d/' + sheetId + '/edit');
  Logger.log('Auto-check every ' + CFG.CHECK_EVERY_MINUTES + ' minutes is on.');
}

/** Runs on the timer: copies the Excel into the Google Sheet only if the Excel changed. */
function syncIfChanged() {
  try {
    var xlsx = findXlsx_();
    var last = Number(PROPS.getProperty('LAST_SYNC_SOURCE_TIME') || 0);
    if (xlsx.getLastUpdated().getTime() <= last) return { changed: false };
    return syncNow_(xlsx);
  } catch (e) {
    notify_(e);
    throw e;
  }
}

/** Run by hand to force a sync. */
function syncNow() { return syncNow_(findXlsx_()); }

function syncNow_(xlsx) {
  var sheetId = PROPS.getProperty('SHEET_ID');
  if (!sheetId) throw new Error('Run setup() first.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    convertInto_(xlsx, sheetId);
    PROPS.setProperty('LAST_SYNC_SOURCE_TIME', String(xlsx.getLastUpdated().getTime()));
    PROPS.setProperty('LAST_SYNC_AT', new Date().toISOString());
    CacheService.getScriptCache().remove('data_v');
    return { changed: true, at: PROPS.getProperty('LAST_SYNC_AT') };
  } finally {
    lock.releaseLock();
  }
}

// Works with either version of the Drive API advanced service (v3 is the default, v2 is older).
function driveApi_() {
  if (typeof Drive === 'undefined') {
    throw new Error('Drive API is not added. In the editor: Services (+) → Drive API → Add, then run again.');
  }
  return typeof Drive.Files.create === 'function' ? 3 : 2;
}
function convertNew_(xlsx, folder) {
  if (driveApi_() === 3) {
    return Drive.Files.create(
      { name: CFG.SHEET_TITLE, mimeType: MimeType.GOOGLE_SHEETS, parents: [folder.getId()] },
      xlsx.getBlob()).id;
  }
  return Drive.Files.insert(
    { title: CFG.SHEET_TITLE, mimeType: MimeType.GOOGLE_SHEETS, parents: [{ id: folder.getId() }] },
    xlsx.getBlob(), { convert: true }).id;
}
function convertInto_(xlsx, sheetId) {
  if (driveApi_() === 3) {
    Drive.Files.update({ mimeType: MimeType.GOOGLE_SHEETS }, sheetId, xlsx.getBlob());
  } else {
    Drive.Files.update({ mimeType: MimeType.GOOGLE_SHEETS }, sheetId, xlsx.getBlob(), { convert: true });
  }
}
function getFolder_() {
  var it = DriveApp.getFoldersByName(CFG.FOLDER_NAME);
  if (!it.hasNext()) throw new Error('Folder "' + CFG.FOLDER_NAME + '" not found in Google Drive.');
  return it.next();
}
function findXlsx_() {
  var it = getFolder_().getFilesByName(CFG.XLSX_NAME), newest = null;
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed()) continue;
    if (!newest || f.getLastUpdated() > newest.getLastUpdated()) newest = f;
  }
  if (!newest) throw new Error('"' + CFG.XLSX_NAME + '" not found in folder "' + CFG.FOLDER_NAME + '".');
  return newest;
}
function exists_(id) {
  try { return !DriveApp.getFileById(id).isTrashed(); } catch (e) { return false; }
}
function notify_(e) {
  if (!CFG.EMAIL_ON_ERROR) return;
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Borrower Profiles sync failed', String(e && e.stack || e));
}

// ============================================================ API
function doGet() { return json_({ ok: true, service: 'Borrower Profiles API', version: 1 }); }

function doPost(e) {
  try {
    var req = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (req.action === 'ping') return json_({ ok: true, time: new Date().toISOString() });
    if (req.action === 'login') return json_(login_(req));
    var user = verifyToken_(req.token);
    if (!user) return json_({ ok: false, error: 'AUTH', message: 'Session expired. Sign in again.' });
    switch (req.action) {
      case 'data':   return json_(data_());
      case 'update': return json_(update_());
      default:       return json_({ ok: false, error: 'UNKNOWN_ACTION', message: 'Unknown action: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: 'SERVER', message: String(err && err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---- sign-in through Loan CRM
function login_(req) {
  var username = String(req.username || '').trim().toLowerCase(), pin = String(req.pin || '').trim();
  if (!username || !pin) return { ok: false, message: 'Enter your username and PIN.' };
  var res = UrlFetchApp.fetch(CFG.LOAN_CRM_API, {
    method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
    payload: JSON.stringify({ action: 'login', username: username, pin: pin })
  });
  var r;
  try { r = JSON.parse(res.getContentText()); } catch (e) { return { ok: false, message: 'Loan CRM did not answer. Try again.' }; }
  if (!r.ok) return { ok: false, message: r.message || 'Wrong username or PIN.' };
  if (r.mustChangePin) return { ok: false, message: 'Set your own PIN in Loan CRM first, then sign in here.' };
  if (CFG.ALLOWED_ROLES.indexOf(r.user.role) === -1) return { ok: false, message: 'Your login does not have access to borrower profiles.' };
  return { ok: true, token: makeToken_(r.user), user: r.user };
}
function makeToken_(u) {
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ n: u.username, d: u.name, r: u.role, e: Date.now() + CFG.TOKEN_TTL_DAYS * 864e5 }));
  return payload + '.' + sign_(payload);
}
function sign_(t) {
  var secret = PROPS.getProperty('SECRET');
  if (!secret) throw new Error('Run setup() first.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(t, secret));
}
function verifyToken_(token) {
  var p = String(token || '').split('.');
  if (p.length !== 2 || sign_(p[0]) !== p[1]) return null;
  try {
    var d = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0])).getDataAsString());
    if (!d.e || d.e < Date.now() || CFG.ALLOWED_ROLES.indexOf(d.r) === -1) return null;
    return { username: d.n, name: d.d, role: d.r };
  } catch (e) { return null; }
}

// ---- update button: pull in the latest Excel if it changed
function update_() {
  var xlsx = findXlsx_();
  var last = Number(PROPS.getProperty('LAST_SYNC_SOURCE_TIME') || 0);
  var changed = xlsx.getLastUpdated().getTime() > last;
  if (changed) syncNow_(xlsx);
  return { ok: true, changed: changed, lastSyncAt: PROPS.getProperty('LAST_SYNC_AT'), sourceModified: xlsx.getLastUpdated().toISOString() };
}

// ---- customer data
function readTable_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var v = sh.getDataRange().getDisplayValues();
  var head = v.shift();
  return v.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {}; head.forEach(function (h, i) { if (h) o[h] = r[i]; }); return o;
  });
}
function last10_(m) { var d = String(m || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }

function data_() {
  var ss = SpreadsheetApp.openById(PROPS.getProperty('SHEET_ID'));
  var prof = readTable_(ss, 'Borrower Profiles');
  var inv = readTable_(ss, 'Investment & Insurance');

  var loansBy = {};
  prof.forEach(function (r) {
    (loansBy[r['Customer ID']] = loansBy[r['Customer ID']] || []).push({
      type: r['Loan Type'], scheme: r['Scheme'], amount: r['Loan Amount (Rs)'], asset: r['Asset Financed'],
      make: r['Vehicle Make'], dealer: r['Dealer'], cost: r['On-Road / Project Cost (Rs)'], roi: r['ROI %'],
      tenure: r['Tenure (Months)'], emi: r['EMI (Rs)'], sanctionDate: r['Sanction Date'],
      remaining: r['Remaining Months'], outstanding: r['Outstanding Used (Rs)'] || r['Est. Outstanding (Rs)'],
      acctNo: r['Loan Account No'], cbsType: r['CBS Account Type'], cbsSanction: r['CBS Sanction Date'],
      cbsLimit: r['CBS Limit (Rs)'], cbsOutstanding: r['Outstanding per CBS (Rs)'], irregularity: r['Irregularity (Rs)'],
      emisOverdue: r['EMIs Overdue'], irac: r['IRAC'], status: r['Account Status'], match: r['Account Match'],
      anniversary: r['Next Insurance / Loan Anniversary'], regNo: r['Vehicle Reg No'],
      coApplicant: r['Co-Applicant'], guarantor: r['Guarantor'], suggested: r['Suggested Products'],
      pitch: r['Pitch Angle'], priority: r['Lead Priority'], source: r['Source File'],
      cibil: r['CIBIL'], cibilBand: r['CIBIL Band'], address: r['Full Address'], locality: r['Locality'],
      district: r['District'], relation: r['Relation (S/O, W/O)'], employer: r['Employer / Business'],
      incomeSeg: r['Income Segment'], household: r['Household Link'], notes: r['Profile Notes'],
      existingLoans: r['Existing Loans / Liabilities'], customerType: r['Customer Type']
    });
  });

  var loanLeads = leadsByMobile_(CFG.LOAN_CRM_SHEET_ID, function (l) {
    return { product: l.product, stage: l.stage, amount: l.amount, date: l.createdAt };
  });
  var cveLeads = leadsByMobile_(CFG.CVE_CRM_SHEET_ID, function (l) {
    return { product: [l.vertical, l.product || l.category].filter(String).join(' · '), stage: l.status, amount: l.amount, date: l.createdAt };
  });

  var FITS = ['Term Plan', 'Health Insurance', 'SIP', 'Lumpsum MF / FD', 'Endowment Plan', 'ULIP', 'Child Plan', 'Retirement / Pension Plan', 'NPS', 'Govt Schemes (PMJJBY/PMSBY/APY)'];
  var customers = inv.map(function (r) {
    var loans = loansBy[r['Customer ID']] || [];
    var first = loans[0] || {};
    var fits = {}; FITS.forEach(function (f) { if (r[f]) fits[f] = r[f]; });
    var m = last10_(r['Mobile']);
    return {
      id: r['Customer ID'], name: r['Borrower Name'], mobile: r['Mobile'], gender: r['Gender'], age: r['Current Age'],
      occ: r['Occupation'], occDetail: r['Occupation Detail'], segment: r['Employment Segment'], stage: r['Life Stage'],
      income: r['Gross Annual Income (Rs)'], netWorth: r['Net Worth (Rs Lakh)'], nmi: r['Net Monthly Income (Rs)'],
      emisUs: r['Active EMIs with Us (Rs/m)'], emisOther: r['Other EMIs (Rs/m)'], surplus: r['Est. Monthly Surplus (Rs)'],
      sip: r['Suggested SIP (Rs/m)'], outstanding: r['Loans O/s with Us (Rs)'], termCover: r['Suggested Term Cover (Rs Lakh)'],
      marital: r['Marital Status'], spouse: r['Spouse'], children: r['Children'], parents: r['Dependent Parents'],
      lifeCover: r['Life Cover Held'], healthCover: r['Health Cover Held'], loanCover: r['Loan-linked Cover'],
      retirement: r['Retirement Savings'], investments: r['Investments Held'], gold: r['Gold'], realEstate: r['Real Estate'],
      agri: r['Agricultural Land'], otherIncome: r['Other Income'], benefits: r['Employer Benefits'],
      fits: fits, top3: r['Top 3 Picks'], talk: r['Talking Points'], priority: r['Wealth Lead Priority'],
      self: r['Life-stage Products (Self)'], forSpouse: r['For Spouse'], forChildren: r['For Children'],
      forParents: r['For Parents'], empProducts: r['Employment-based Products'], wealthNotes: r['Wealth & Family Notes'],
      confidence: r['Data Confidence'],
      cibil: first.cibil, cibilBand: first.cibilBand, address: first.address, locality: first.locality, district: first.district,
      relation: first.relation, employer: first.employer, incomeSeg: first.incomeSeg, household: first.household,
      loanPriority: loans.map(function (l) { return l.priority; }).sort()[0] || '',
      loans: loans,
      inLoanCrm: m ? (loanLeads[m] || []) : [], inCveCrm: m ? (cveLeads[m] || []) : []
    };
  });
  var maps = {
    age: readMap_(ss, 'Age-wise Product Map'),
    employment: readMap_(ss, 'Employment Product Map')
  };
  return { ok: true, lastSyncAt: PROPS.getProperty('LAST_SYNC_AT'), customers: customers, maps: maps };
}

function readMap_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var v = sh.getDataRange().getDisplayValues().slice(2);   // row 3 is the header
  var head = v.shift();
  return v.filter(function (r) { return r[0]; }).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

function leadsByMobile_(sheetId, pick) {
  var out = {};
  try {
    var sh = SpreadsheetApp.openById(sheetId).getSheetByName('Leads');
    var v = sh.getDataRange().getValues(), head = v.shift();
    v.forEach(function (row) {
      var l = {}; head.forEach(function (h, i) { l[h] = row[i]; });
      if (String(l.deleted).toUpperCase() === 'TRUE') return;
      var m = last10_(l.mobile); if (!m) return;
      var o = pick(l);
      o.date = o.date instanceof Date ? Utilities.formatDate(o.date, Session.getScriptTimeZone(), 'dd-MM-yyyy') : String(o.date || '').slice(0, 10);
      (out[m] = out[m] || []).push(o);
    });
  } catch (e) { /* the other app's sheet is not reachable: skip the look-up */ }
  return out;
}
