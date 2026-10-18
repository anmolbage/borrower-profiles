/* Made-up sample customers for ?demo=1. No real data. */
window.BP_DEMO = (function () {
  const first = ['Rajesh', 'Priya', 'Mohan', 'Anita', 'Suresh', 'Kavita', 'Vikram', 'Neha', 'Arun', 'Pooja', 'Deepak', 'Sunita', 'Rahul', 'Meena', 'Ajay', 'Ritu'];
  const last = ['Kumar', 'Singh', 'Prasad', 'Devi', 'Gupta', 'Mahto', 'Sharma', 'Verma'];
  const segs = ['Govt Employee', 'PSU / Coal (CCL etc.)', 'Private Salaried', 'Business Owner / Trader', 'Self-employed Professional', 'Bank / Financial Staff'];
  const occ = { 'Govt Employee': 'Salaried-Govt', 'PSU / Coal (CCL etc.)': 'Salaried-PSU', 'Private Salaried': 'Salaried-Private', 'Business Owner / Trader': 'Business', 'Self-employed Professional': 'Self-employed Professional', 'Bank / Financial Staff': 'Salaried-PSU' };
  const stages = [['Starter', 18, 25], ['Young Family', 26, 35], ['Established Family', 36, 45], ['Peak Earning', 46, 55], ['Pre-Retirement', 56, 60], ['Retired', 61, 120]];
  const loanTypes = ['Car Loan', 'Car Loan', 'Car Loan', 'Housing Loan', 'Cash Credit', 'Personal Loan'];
  const fitsAll = ['Term Plan', 'Health Insurance', 'SIP', 'Lumpsum MF / FD', 'Endowment Plan', 'ULIP', 'Child Plan', 'Retirement / Pension Plan', 'NPS', 'Govt Schemes (PMJJBY/PMSBY/APY)'];
  const inr = n => Math.round(n).toLocaleString('en-IN');
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const pick = a => a[Math.floor(rnd() * a.length)];

  const customers = [];
  for (let i = 0; i < 36; i++) {
    const name = first[i % first.length] + ' ' + pick(last);
    const age = 24 + Math.floor(rnd() * 40);
    const stage = stages.find(s => age >= s[1] && age <= s[2])[0];
    const seg = pick(segs);
    const income = 300000 + Math.round(rnd() * 1800000);
    const nmi = income / 12 * 0.8, emi = 6000 + rnd() * 20000, surplus = Math.max(0, nmi * 0.6 - emi);
    const nLoans = rnd() > 0.8 ? 2 : 1;
    const loans = [];
    for (let j = 0; j < nLoans; j++) {
      const t = pick(loanTypes), amt = t === 'Housing Loan' ? 2500000 : t === 'Cash Credit' ? 1000000 : 700000;
      loans.push({ type: t, scheme: 'JRGB ' + t, amount: inr(amt), asset: t === 'Car Loan' ? pick(['Maruti Suzuki Brezza', 'Tata Nexon', 'Hyundai Creta', 'Mahindra XUV300']) : t === 'Housing Loan' ? 'Construction of house, Ramgarh' : 'Working capital',
        roi: '8.65', tenure: t === 'Housing Loan' ? '240' : '84', emi: inr(emi), sanctionDate: '1' + j + '-0' + (3 + j) + '-2024', remaining: '50', outstanding: inr(amt * 0.7),
        anniversary: '1' + j + '-0' + (3 + j) + '-2027', regNo: t === 'Car Loan' ? 'JH24AB' + (1000 + i) : '', guarantor: pick(first) + ' ' + pick(last),
        suggested: t === 'Car Loan' ? 'Motor Insurance Renewal; Housing Loan; Pre-approved Personal Loan' : 'Home Insurance; Car Loan', pitch: 'good repayment; seasoned loan',
        priority: pick(['A - Hot', 'B - Warm', 'B - Warm', 'C - Nurture']), source: 'Sample note ' + (i + 1) + '.pdf',
        acctNo: '8400' + String(1000000 + i * 7919 + j), cbsType: 'TL-' + t.toUpperCase(), cbsOutstanding: inr(amt * 0.65),
        status: pick(['Regular', 'Regular', 'Regular', 'SMA-0: 1 EMI(s) overdue, Rs 9,000 irregular', 'SMA-1: 2 EMI(s) overdue, Rs 18,000 irregular']),
        match: 'High: name, amount, sanction date (0 days apart)' });
    }
    const fits = {}; fitsAll.forEach(f => { const r = rnd(); if (r > 0.55) fits[f] = r > 0.78 ? 'High' : 'Medium'; });
    customers.push({
      id: 'C' + String(i + 1).padStart(3, '0'), name, mobile: '90000' + String(10000 + i * 137).slice(-5), gender: rnd() > 0.3 ? 'M' : 'F', age: String(age),
      occ: occ[seg], occDetail: seg === 'PSU / Coal (CCL etc.)' ? 'Senior Overman, CCL' : seg === 'Business Owner / Trader' ? 'Hardware shop' : 'Teacher, Govt High School',
      segment: seg, stage, income: inr(income), netWorth: (10 + rnd() * 80).toFixed(2), nmi: inr(nmi), emisUs: inr(emi), emisOther: '-', surplus: inr(surplus),
      sip: inr(Math.round(surplus * 0.5 / 500) * 500), outstanding: inr(loans.length * 500000), termCover: String(Math.round(income * 10 / 1e5)),
      marital: rnd() > 0.4 ? 'Married' : '', spouse: rnd() > 0.6 ? 'Homemaker' : '', children: rnd() > 0.7 ? '1 son, 1 daughter (school-going)' : '', parents: rnd() > 0.8 ? 'Yes' : '',
      lifeCover: rnd() > 0.8 ? 'LIC endowment, SA Rs 5 L' : '', healthCover: '', loanCover: 'Vehicle comprehensive insurance only', retirement: seg.startsWith('PSU') ? 'CMPF + pension' : '',
      investments: rnd() > 0.85 ? 'FD Rs 2 L' : '', gold: '', realEstate: rnd() > 0.6 ? 'Own house, Ramgarh' : '', agri: '', otherIncome: '', benefits: seg.startsWith('PSU') ? 'CCL medical' : '',
      fits, top3: Object.keys(fits).slice(0, 3).join('; '), talk: 'Term Plan: no life cover seen; family + loans to protect | SIP: est. surplus Rs ' + inr(surplus) + '/m',
      priority: pick(['A - Hot', 'B - Warm', 'B - Warm', 'C - Nurture']),
      self: 'SIP Rs 5-15k in equity / flexi-cap; ELSS for 80C | Term cover 10-15x income + loans; family floater health',
      forSpouse: 'NPS / SIP in spouse\'s name; health floater', forChildren: '(typical age 5-18) Child education plan / SIP for higher studies; Sukanya if daughter < 10',
      forParents: '(typical age 60-75) Senior health; SCSS + Senior Citizen FD', empProducts: 'Invest: SIP + lumpsum MF | Insure: Term plan; health super top-up | Pitch: Plan for retirement health and wealth',
      wealthNotes: 'Sample customer for demo mode.', confidence: pick(['High', 'Medium']),
      cibil: String(650 + Math.floor(rnd() * 180)), cibilBand: 'Excellent', address: 'Ward ' + (i + 1) + ', Ramgarh Cantt', locality: pick(['Ramgarh Cantt', 'Bhurkunda', 'Patratu', 'Gola', 'Chitarpur']), district: 'Ramgarh',
      relation: 'S/O ' + pick(first) + ' ' + pick(last), employer: '', incomeSeg: income >= 1500000 ? 'HNI (15L+)' : income >= 800000 ? 'Affluent (8-15L)' : 'Mid (4-8L)', household: '',
      loanPriority: loans[0].priority, loans,
      inLoanCrm: rnd() > 0.8 ? [{ product: 'Home Loan', stage: 'Processing at RO', amount: 2500000, date: '02-10-2026' }] : [],
      inCveCrm: rnd() > 0.85 ? [{ product: 'SBI Life · Term', stage: 'Follow-up', amount: 25000, date: '28-09-2026' }] : []
    });
  }
  const maps = {
    age: stages.map(s => ({ 'Life Stage': s[0], 'Age From': String(s[1]), 'Age To': String(s[2]), 'Typical Needs': 'Sample needs for ' + s[0].toLowerCase(), 'Self – Investment': 'SIP; FD', 'Self – Insurance': 'Term; health', 'Self – Loans': 'Home / car loan', 'For Spouse': 'NPS; health', 'Children (typical age)': '5-18', 'For Children': 'Education SIP', 'Parents (typical age)': '60-75', 'For Parents': 'Senior health; SCSS' })),
    employment: segs.map(s => ({ 'Employment Segment': s, 'Profile & Needs': 'Sample profile', 'Investment': 'SIP; NPS', 'Insurance': 'Term; health', 'Loans & Banking': 'Car / home loan', 'Best Pitch Angle': 'Security and tax saving', 'Avoid / Note': '—' }))
  };
  return { ok: true, lastSyncAt: new Date().toISOString(), customers, maps };
})();
