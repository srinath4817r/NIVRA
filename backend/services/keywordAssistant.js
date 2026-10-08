// backend/services/keywordAssistant.js — rule-based answers used when Claude is not configured or unavailable
const { scholarships, educationLoans, governmentSchemes, serviceGuides } = require('../data/content');

function keywordAnswer(query) {
  const text = query.toLowerCase();

  // Problem Classification Logic
  let intentCategory = "GENERAL_GUIDANCE";
  let responseText = "";
  let matchedItems = [];
  let nextSteps = [];
  let documentChecklist = [];
  let officialSources = [];
  let urgentAction = false;

  // 1. Disaster / Emergency Rescue
  if (text.match(/flood|waterlog|rain|trapped|shelter|cyclone|earthquake|storm|fire emergency|rescue|disaster|relief camp/i)) {
    intentCategory = "DISASTER_ASSISTANCE";
    urgentAction = true;
    responseText = "🚨 I identified your situation as a **Disaster & Emergency Assistance Requirement**. Follow the steps below, and open the Emergency tab for help near you.";
    matchedItems = [];
    nextSteps = [
      "Stay on elevated ground away from electric poles and active floodwater.",
      "Call National Disaster Response Force / State Helpline at 1070 or Emergency 112.",
      "Open the Emergency tab to see hospitals, police and fire stations near your location.",
      "Use the 'Report Disaster Issue' button to broadcast your exact location to local rescue teams."
    ];
    officialSources = [
      { name: "NDMA (National Disaster Management Authority)", url: "https://ndma.gov.in" },
      { name: "National Emergency Response Support System (112)", url: "https://112.gov.in" }
    ];
  }
  // 2. Immediate Medical / Police / Ambulance Emergency
  else if (text.match(/hospital|ambulance|police|accident|doctor|bleeding|heart attack|fire|stolen|help me|emergency/i)) {
    intentCategory = "EMERGENCY_LOCATOR";
    urgentAction = true;
    responseText = "🚑 I classified your query as an **Emergency Service Locator Request**. Quick response contact numbers and nearby facilities are ready.";
    matchedItems = [];
    nextSteps = [
      "Dial 108 for Medical Ambulance or 112 for Unified Emergency Support instantly.",
      "Open the Emergency tab to find the nearest hospital on the map.",
      "If reporting a crime or fire, contact 100 (Police) or 101 (Fire Command)."
    ];
    officialSources = [
      { name: "National Health Portal (108)", url: "https://nhp.gov.in" },
      { name: "Emergency Response Support System (112)", url: "https://112.gov.in" }
    ];
  }
  // 3. Student Education Loans
  else if (text.match(/loan|education loan|interest rate|vidya lakshmi|collateral|bank loan|tuition loan|study loan/i)) {
    intentCategory = "STUDENT_LOAN";
    responseText = "🏦 I identified your requirement as **Student Education Loan Assistance**. You do not need collateral for loans up to ₹7.5 Lakhs under government schemes.";
    matchedItems = educationLoans;
    documentChecklist = [
      "Admit Card / College Admission Sanction Letter",
      "Course Fee Structure issued by College",
      "10th & 12th Academic Marksheets",
      "Parents' Income Proof (Salary slip / Form 16 / ITR / Tehsildar Certificate)",
      "Student & Parent Aadhaar + PAN Cards"
    ];
    nextSteps = [
      "Fill out the Single Common Application Form on Vidya Lakshmi Portal.",
      "Check if you qualify for 100% interest subsidy during study period under CSIS Scheme (Family income ≤ ₹4.5 Lakhs).",
      "Select up to 3 preferred nationalized banks on the portal for fast sanctioning."
    ];
    officialSources = [
      { name: "Vidya Lakshmi Portal (Official Govt Loan Portal)", url: "https://www.vidyalakshmi.co.in" },
      { name: "CSIS Interest Subsidy Scheme", url: "https://www.education.gov.in/csis" }
    ];
  }
  // 4. Student Scholarships & Fee Assistance
  else if (text.match(/scholarship|fee|tuition|btech|college|student|financial support|stipend|girl student|marksheet|post-matric|nmmss/i)) {
    intentCategory = "STUDENT_SCHOLARSHIP";
    responseText = "🎓 I classified your request under **Student Scholarship & Educational Benefits**. Here are government schemes matched to your profile for financial assistance.";
    
    // Custom filter based on query keywords
    if (text.includes("girl") || text.includes("female") || text.includes("women")) {
      matchedItems = scholarships.filter(s => s.tags.includes("girls") || s.tags.includes("merit"));
    } else if (/\b(sc|st|obc)\b/.test(text)) {
      matchedItems = scholarships.filter(s => s.tags.includes("sc") || s.tags.includes("st") || s.tags.includes("obc"));
    } else {
      matchedItems = scholarships;
    }

    documentChecklist = [
      "Aadhaar Card (linked to Bank Account for Direct Benefit Transfer - DBT)",
      "Previous Qualifying Examination Marksheet",
      "Current Financial Year Income Certificate",
      "Caste / Community Certificate (if claiming reservation benefits)",
      "Bonafide Certificate & Admission Fee Receipt from School/College"
    ];
    nextSteps = [
      "Register on the National Scholarship Portal (NSP) or State Portal.",
      "Verify that your Bank Account is seeded with your Aadhaar number for smooth DBT transfer.",
      "Upload required documents before the official deadline."
    ];
    officialSources = [
      { name: "National Scholarship Portal (NSP)", url: "https://scholarships.gov.in" },
      { name: "AICTE Pragati Portal", url: "https://www.aicte-india.org" }
    ];
  }
  // 5. Government Certificate & Document Guides
  else if (text.match(/certificate|caste|income|ration|aadhaar|license|passport|voter|meeseva|edistrict/i)) {
    intentCategory = "GOVT_SERVICE_GUIDE";
    responseText = "📄 I categorized your query under **Government Certificate & Document Process Guide**. Follow the step-by-step guidance below without visiting multiple offices.";
    matchedItems = serviceGuides;
    documentChecklist = serviceGuides[0].documentsNeeded;
    nextSteps = serviceGuides[0].steps;
    officialSources = [
      { name: "National e-District Portal", url: "https://edistrict.gov.in" },
      { name: "MeeSeva / State e-Seva Portals", url: "https://services.india.gov.in" }
    ];
  }
  // 6. Citizen Government Schemes
  else if (text.match(/scheme|farmer|kisan|ayushman|health card|vishwakarma|housing|pmay|pension|benefit/i)) {
    intentCategory = "GOVT_SCHEME";
    responseText = "🇮🇳 I identified your query as a **Government Welfare Scheme Finder Request**. Here are government benefit programs suited for citizens.";
    matchedItems = governmentSchemes;
    documentChecklist = [
      "Aadhaar Card",
      "Ration Card / BPL Card",
      "Bank Account details",
      "Mobile number for OTP verification"
    ];
    nextSteps = [
      "Check basic eligibility breakdown for your chosen scheme below.",
      "Gather your Aadhaar and Ration Card documents.",
      "Apply through myScheme portal or visit your nearest Common Service Center (CSC)."
    ];
    officialSources = [
      { name: "myScheme Official Portal", url: "https://www.myscheme.gov.in" },
      { name: "Digital India Services", url: "https://digitalindia.gov.in" }
    ];
  }
  // Fallback / General Query
  else {
    intentCategory = "GENERAL_GUIDANCE";
    responseText = "💡 I have analyzed your requirement. Based on your prompt, here is a breakdown of government, student, and emergency services available on our platform.";
    matchedItems = scholarships.slice(0, 2).concat(governmentSchemes.slice(0, 1));
    nextSteps = [
      "Select your role above (Student, Citizen, or Emergency).",
      "Use our specialized finders for Scholarships, Education Loans, or Government Schemes.",
      "Or type a specific question like: 'I need financial help for my engineering college fees'."
    ];
    officialSources = [
      { name: "National Portal of India", url: "https://www.india.gov.in" },
      { name: "myScheme Portal", url: "https://www.myscheme.gov.in" }
    ];
  }

  return {
    success: true,
    aiMode: "basic",
    query: query,
    intentCategory: intentCategory,
    urgentAction: urgentAction,
    responseText: responseText,
    matchedItems: matchedItems,
    documentChecklist: documentChecklist,
    nextSteps: nextSteps,
    officialSources: officialSources,
    disclaimer: "Note: AI guidance is for informational purposes. Official eligibility and approval rests with respective government departments."
  };
}


module.exports = { keywordAnswer };
