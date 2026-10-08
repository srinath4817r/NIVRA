// frontend/src/services/api.js
// Public content + AI. Content falls back to bundled samples when the API is unreachable;
// user data (services/userApi.js) never fakes success.
import { API_BASE_URL, getJSON, request } from './http';

/**
 * Ask the assistant. `history` is the recent conversation so follow-up questions work.
 * Throws ApiError when the server can't be reached (no fake answers).
 */
export function sendAIQuery(query, history = [], language = 'en') {
  return request('/ai/chat', { method: 'POST', body: { query, history, language } });
}

/**
 * Analyse a report photo. Resolves to { available: false } when the server has no AI configured.
 */
export async function analyzePhoto(file, note) {
  const form = new FormData();
  form.append('image', file);
  if (note) form.append('note', note);
  try {
    return await request('/ai/analyze-image', { method: 'POST', form });
  } catch (err) {
    if (err.status === 503) return { available: false };
    throw err;
  }
}

/**
 * Fetch Scholarships
 */
export async function getScholarships(category = 'all', search = '') {
  try {
    const data = await getJSON('/scholarships', { category, search });
    return data.data || [];
  } catch {
    return fallbackScholarships;
  }
}

/**
 * Fetch one scholarship (null when it doesn't exist)
 */
export async function getScholarshipById(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/scholarships/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Scholarship lookup failed');
    const data = await res.json();
    return data.data || null;
  } catch {
    return fallbackScholarships.find(s => s.id === id) || null;
  }
}

/**
 * Fetch Education Loans
 */
export async function getEducationLoans() {
  try {
    const data = await getJSON('/loans');
    return data.data || [];
  } catch {
    return fallbackLoans;
  }
}

/**
 * Fetch Government Schemes
 */
export async function getGovernmentSchemes(search = '') {
  try {
    const data = await getJSON('/schemes', { search });
    return data.data || [];
  } catch {
    return fallbackSchemes;
  }
}

/**
 * Fetch Government Service Guides
 */
export async function getServiceGuides() {
  try {
    const data = await getJSON('/guides');
    return data.data || [];
  } catch {
    return fallbackGuides;
  }
}

// Fallback datasets for offline client resilience
const fallbackScholarships = [
  {
    id: "sch-1",
    name: "National Means-cum-Merit Scholarship Scheme (NMMSS)",
    category: "Merit & Financial Assistance",
    level: "Class 9 to 12",
    offeredBy: "Ministry of Education, Govt. of India",
    amount: "₹12,000 per annum",
    eligibility: ["Students studying in Class IX in Govt/Aided schools", "Minimum 55% marks in Class VIII", "Annual income ≤ ₹3,50,000"],
    documents: ["Class 8 Marksheet", "Income Certificate", "Caste Certificate", "Aadhaar Card"],
    deadline: "2026-11-30",
    officialLink: "https://scholarships.gov.in",
    tags: ["school", "merit", "low-income"]
  },
  {
    id: "sch-2",
    name: "Central Sector Scheme of Scholarships for College and University Students",
    category: "Higher Education",
    level: "Undergraduate / Postgraduate",
    offeredBy: "Department of Higher Education (MHRD)",
    amount: "₹12,000 - ₹20,000 per annum",
    eligibility: ["Above 80th percentile in Class 12 board", "Regular degree course", "Income ≤ ₹4.5 Lakhs"],
    documents: ["Class 12 Marksheet", "Income Certificate", "College Fee Receipt", "Bank Passbook"],
    deadline: "2026-12-15",
    officialLink: "https://scholarships.gov.in",
    tags: ["college", "btech", "degree"]
  },
  {
    id: "sch-3",
    name: "AICTE Pragati Scholarship Scheme for Girl Students",
    category: "Technical Education / Girls",
    level: "B.Tech / Polytechnic Diploma",
    offeredBy: "AICTE",
    amount: "₹50,000 per annum",
    eligibility: ["Girl student admitted to 1st year B.Tech/Diploma", "Max 2 girls per family", "Income ≤ ₹8 Lakhs"],
    documents: ["12th Marksheet", "College Allotment Letter", "Income Certificate"],
    deadline: "2026-10-31",
    officialLink: "https://www.aicte-india.org",
    tags: ["girls", "btech", "engineering"]
  }
];

const fallbackLoans = [
  {
    id: "loan-1",
    schemeName: "Vidya Lakshmi Education Loan Scheme",
    offeredBy: "Ministry of Finance & IBA",
    maxLoanAmount: "Up to ₹7.5 Lakhs (Collateral Free)",
    interestRate: "8.15% - 10.50% p.a.",
    eligibility: ["Indian National with confirmed college admission through merit/entrance exam"],
    keyFeatures: ["Single form for 40+ banks", "Moratorium: Course duration + 1 year", "15 years repayment"],
    requiredDocuments: ["Admission letter & Fee breakdown", "Academic marksheets", "KYC Aadhaar/PAN", "Parent Income proof"],
    officialSource: "https://www.vidyalakshmi.co.in"
  },
  {
    id: "loan-2",
    schemeName: "Central Sector Interest Subsidy Scheme (CSIS)",
    offeredBy: "Ministry of Education",
    maxLoanAmount: "Full Interest Subsidy on loans up to ₹10 Lakhs during study",
    interestRate: "0% interest during course + 1 yr moratorium",
    eligibility: ["EWS Students with annual family income ≤ ₹4.5 Lakhs"],
    keyFeatures: ["Government pays 100% interest while studying"],
    requiredDocuments: ["EWS Certificate issued by Tehsildar", "Bank Loan Sanction Letter"],
    officialSource: "https://www.education.gov.in/csis"
  }
];

const fallbackSchemes = [
  {
    id: "gov-1",
    name: "Ayushman Bharat - PM-JAY",
    ministry: "Ministry of Health",
    category: "Healthcare",
    benefit: "Free hospital coverage up to ₹5 Lakhs per family per year",
    eligibility: ["Low income families listed in SECC database / Ayushman Card holders"],
    documents: ["Aadhaar Card", "Ration Card"],
    process: "Visit Ayushman Kendra at nearest Empanelled Hospital",
    officialLink: "https://pmjay.gov.in"
  },
  {
    id: "gov-2",
    name: "PM Vishwakarma Scheme",
    ministry: "MSME Ministry",
    category: "Skill & Loan",
    benefit: "Credit up to ₹3 Lakhs at 5% interest + ₹15,000 Toolkit Incentive",
    eligibility: ["Traditional Artisans & Craftsmen in 18 trades"],
    documents: ["Aadhaar", "Bank Account", "Trade proof"],
    process: "Apply online at PM Vishwakarma portal or CSC center",
    officialLink: "https://pmvishwakarma.gov.in"
  }
];

const fallbackGuides = [
  {
    id: "guide-1",
    serviceName: "Caste & Community Certificate Application",
    department: "Revenue Department",
    purpose: "Required for reservation benefits in educational admissions & scholarships.",
    steps: [
      "Visit official State e-District portal",
      "Upload Identity Proof (Aadhaar) and Father/Relative Caste Certificate",
      "Pay nominal application fee (₹15 - ₹35)",
      "Download digital signed certificate upon Tehsildar approval (3-7 days)."
    ],
    documentsNeeded: [
      "Aadhaar Card",
      "School Leaving / Transfer Certificate",
      "Father/Parent Caste Proof",
      "Self-Declaration Affidavit"
    ],
    officialPortal: "https://edistrict.gov.in"
  }
];
