/* Borrower Profiles — configuration
   After you deploy apps-script/Code.gs as a web app, paste its /exec URL into API_URL. */
window.BP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwZLGe1GLWI2wO9BzPM2iwnfHs97kFwppcecpz--SNoLt2slq71tVVFs97CdDXWHGX-/exec',
  APP_NAME: 'Profiles',
  VERSION: '1.2.0',
  BRANCH_NAME: 'Ramgarh Cantt',

  // Your other apps (shown in the Apps tab)
  APPS: [
    { name: 'Loan CRM', desc: 'Loan leads, enquiry to disbursement', url: 'https://anmolbage.github.io/loan-crm/', color: '#0f2a4a', glyph: '₹' },
    { name: 'CVE CRM', desc: 'SBI Life, General and Mutual Fund leads', url: 'https://anmolbage.github.io/CVE-CRM/', color: '#3d5afe', glyph: 'C' }
  ],
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1OhyxjHHSJ84GvSefsX8TfiSkFE2PmwYF0W__WfBH-Ws/edit',

  // ?demo=1 runs on made-up sample customers with no backend
  DEMO_MODE: /[?&]demo=1/.test(location.search)
};
