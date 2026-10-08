// backend/services/ai.js — Claude-powered assistant + photo analysis
// Answers are grounded in NIVRA's own catalog (sent as a cached system prompt) and returned
// as schema-validated JSON. Links and item ids are filtered server-side so the model can't
// send users to a URL or scheme that isn't in the catalog.
const Anthropic = require('@anthropic-ai/sdk');
const { toStrictSchema } = require('./jsonSchema');
const { z } = require('zod');
const config = require('../config');
const content = require('../data/content');

const INTENTS = [
  'STUDENT_SCHOLARSHIP', 'STUDENT_LOAN', 'DISASTER_ASSISTANCE', 'EMERGENCY_LOCATOR',
  'GOVT_SERVICE_GUIDE', 'GOVT_SCHEME', 'GENERAL_GUIDANCE',
];

// Server-side fallback re-runs a safety-declined request on Anthropic's recommended model
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client = null;
const isEnabled = () => !!(client || config.anthropicApiKey);
function getClient() {
  if (!client && config.anthropicApiKey) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}
// Tests inject a fake client
function setClient(c) { client = c; }

// ─────────────── Catalog (stable → cacheable) ───────────────
function compactCatalog() {
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
  return {
    scholarships: content.scholarships.map(s => pick(s, ['id', 'name', 'level', 'offeredBy', 'amount', 'eligibility', 'documents', 'applicationWindow', 'officialLink', 'tags'])),
    educationLoans: content.educationLoans.map(l => pick(l, ['id', 'schemeName', 'offeredBy', 'maxLoanAmount', 'interestRate', 'eligibility', 'requiredDocuments', 'applicationWindow', 'officialSource'])),
    governmentSchemes: content.governmentSchemes.map(g => pick(g, ['id', 'name', 'ministry', 'category', 'benefit', 'eligibility', 'documents', 'process', 'officialLink'])),
    certificateGuides: content.serviceGuides.map(g => pick(g, ['id', 'serviceName', 'department', 'purpose', 'steps', 'documentsNeeded', 'officialPortal'])),
  };
}

// Official portals the assistant may cite in addition to catalog links
const EXTRA_SOURCES = [
  { name: 'myScheme (National scheme finder)', url: 'https://www.myscheme.gov.in' },
  { name: 'National Scholarship Portal', url: 'https://scholarships.gov.in' },
  { name: 'National Portal of India', url: 'https://www.india.gov.in' },
  { name: 'NDMA (National Disaster Management Authority)', url: 'https://ndma.gov.in' },
  { name: 'Emergency Response Support System (112)', url: 'https://112.gov.in' },
];

const SYSTEM_PROMPT = `You are NIVRA, an assistant that helps people in India find government scholarships, education loans, welfare schemes and certificate procedures, and get help in emergencies and disasters. Many users are students, first-generation applicants, or people in distress, and some are reading in their second language.

How to answer:
- Work out what the person actually needs and answer that directly in plain, warm, simple English (or the language they wrote in). Keep "reply" short: 2-5 sentences. Use **bold** for the one or two things that matter most.
- Ground every specific claim (amounts, income limits, documents, application windows) in the CATALOG below. The catalog has no exact deadlines: never state a specific date; describe the usual application window and tell them to check the portal. If the catalog doesn't cover their situation, say so honestly and point them to the closest official portal rather than inventing details.
- matchedItemIds: ids from the catalog that genuinely fit the person, best first, at most 4. Leave it empty if nothing fits. Never invent ids.
- documentChecklist and nextSteps: concrete and specific to their case, at most 6 items each. Empty arrays are fine for simple questions.
- sources: only URLs that appear in the CATALOG or in OFFICIAL_PORTALS. Never make up a URL.
- Eligibility rules change; when you mention one, remind them to confirm on the official portal.

Safety:
- If anyone may be in immediate danger (fire, flood, trapped, injured, medical emergency, violence), set urgent to true, and make the first next step "Call 112 now" (108 for ambulance, 101 fire, 100 police, 1070 state disaster helpline), before anything else.
- Never ask for or repeat Aadhaar numbers, bank details, OTPs or passwords. If someone shares them, tell them not to share them with anyone.

Intent: pick the single best category from the schema.

OFFICIAL_PORTALS:
${JSON.stringify(EXTRA_SOURCES)}

CATALOG:
${JSON.stringify(compactCatalog())}`;

const allowedUrls = new Set([
  ...EXTRA_SOURCES.map(s => s.url),
  ...content.scholarships.map(s => s.officialLink),
  ...content.educationLoans.map(l => l.officialSource),
  ...content.governmentSchemes.map(g => g.officialLink),
  ...content.serviceGuides.map(g => g.officialPortal),
].filter(Boolean));

const ChatAnswer = z.object({
  // the API doesn't enforce enums, so an unexpected label degrades to the default
  intent: z.enum(INTENTS).catch('GENERAL_GUIDANCE'),
  urgent: z.boolean(),
  reply: z.string(),
  matchedItemIds: z.array(z.string()),
  documentChecklist: z.array(z.string()),
  nextSteps: z.array(z.string()),
  sources: z.array(z.object({ name: z.string(), url: z.string() })),
});

const CHAT_SCHEMA = toStrictSchema(ChatAnswer);

// Structured output arrives as JSON text in the first text block
function parseJson(response, schema) {
  const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return schema.parse(JSON.parse(text));
}

function profileLine(profile) {
  if (!profile || !Object.keys(profile).length) return '';
  const parts = [];
  if (profile.age) parts.push(`age ${profile.age}`);
  if (profile.gender) parts.push(profile.gender);
  if (profile.category) parts.push(`category ${profile.category.toUpperCase()}`);
  if (profile.annualIncome != null) parts.push(`family income ₹${profile.annualIncome}/year`);
  if (profile.educationLevel) parts.push(`education ${profile.educationLevel}`);
  if (profile.occupation) parts.push(profile.occupation);
  if (profile.state) parts.push(`lives in ${profile.state}`);
  if (profile.disability) parts.push('has a disability');
  return parts.length ? `About me (from my saved profile): ${parts.join(', ')}.\n\n` : '';
}

/**
 * @param {string} query
 * @param {{ history?: {role:'user'|'assistant', text:string}[], profile?: object }} ctx
 */
const LANGUAGE_NAMES = { hi: 'Hindi', te: 'Telugu', ta: 'Tamil', mr: 'Marathi', bn: 'Bengali' };

async function chat(query, { history = [], profile, language = 'en' } = {}) {
  // The app language goes in the user turn (not the system prompt) so the cached catalog prefix stays identical
  const langLine = LANGUAGE_NAMES[language]
    ? `(My app is set to ${LANGUAGE_NAMES[language]}. Reply in ${LANGUAGE_NAMES[language]} unless I write in another language; keep scheme names as they are.)\n\n`
    : '';
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.text })),
    { role: 'user', content: langLine + profileLine(profile) + query },
  ];
  // The API requires the first message to be from the user
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const response = await getClient().beta.messages.create({
    model: config.anthropicModel,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CHAT_SCHEMA } },
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return {
      success: true,
      aiMode: 'claude',
      intentCategory: 'GENERAL_GUIDANCE',
      urgentAction: false,
      responseText: "I can't help with that request. If you need government services or emergency help, please rephrase what you need, or call 112 in an emergency.",
      matchedItems: [], documentChecklist: [], nextSteps: [], officialSources: [],
    };
  }

  const out = parseJson(response, ChatAnswer);

  const seen = new Set();
  return {
    success: true,
    aiMode: 'claude',
    query,
    intentCategory: out.intent,
    urgentAction: out.urgent,
    responseText: out.reply,
    matchedItems: out.matchedItemIds
      .map(id => content.findContentItem(id))
      .filter(item => item && !seen.has(item.id) && seen.add(item.id))
      .slice(0, 4),
    documentChecklist: out.documentChecklist.slice(0, 8),
    nextSteps: out.nextSteps.slice(0, 8),
    officialSources: out.sources.filter(s => allowedUrls.has(s.url)).slice(0, 4),
    disclaimer: 'AI guidance is informational. Final eligibility and approval rest with the government department.',
  };
}

// ─────────────── Photo analysis ───────────────
const PhotoAnalysis = z.object({
  hazardType: z.enum(['flood', 'fire', 'structural_damage', 'landslide', 'road_blocked', 'electrical', 'medical', 'storm_damage', 'document', 'other', 'none']),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  confidence: z.enum(['high', 'medium', 'low']),
  summary: z.string(),
  recommendedActions: z.array(z.string()),
  peopleAtRisk: z.boolean(),
});

const PHOTO_PROMPT = `This photo was attached to a disaster/emergency report in India. Describe only what is actually visible.
- hazardType: the main hazard you can see ("none" if nothing hazardous, "document" if it's a photo of a certificate or ID).
- severity: CRITICAL only for visible immediate danger to life (active fire near people, people in fast water, collapse). Use INFO for documents or non-hazards.
- confidence: how sure you are, given image quality and ambiguity.
- summary: one or two plain sentences a response team can act on.
- recommendedActions: up to 4 short safety actions for the person who took the photo; start with "Call 112" if there's danger to life.
- peopleAtRisk: true only if people appear to be in danger.
If the photo shows an identity document, do not transcribe any numbers from it.`;

const PHOTO_SCHEMA = toStrictSchema(PhotoAnalysis);

async function analyzePhoto(buffer, mimeType, note) {
  const response = await getClient().beta.messages.create({
    model: config.anthropicModel,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PHOTO_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') } },
        { type: 'text', text: PHOTO_PROMPT + (note ? `\n\nThe reporter wrote: "${note.slice(0, 500)}"` : '') },
      ],
    }],
  });

  if (response.stop_reason === 'refusal') {
    return { success: false, error: "This photo couldn't be analysed. You can still submit the report." };
  }
  return { success: true, ...parseJson(response, PhotoAnalysis) };
}

module.exports = { chat, analyzePhoto, isEnabled, setClient, SYSTEM_PROMPT, INTENTS, CHAT_SCHEMA, PHOTO_SCHEMA };
