// Claude integration tests with a fake client (no network, no API key needed)
process.env.NODE_ENV = 'test';

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const db = require('../db');
const ai = require('../services/ai');

after(() => db.close());

const PNG_1PX = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082', 'hex');

let calls;
// The service asks for JSON text; tests describe the answer as `parsed_output` for readability
function fakeClient(respond) {
  return {
    beta: {
      messages: {
        create: async (params) => {
          calls.push(params);
          const r = await respond(params);
          if (!('parsed_output' in r)) return r;
          return {
            stop_reason: r.stop_reason,
            content: r.parsed_output ? [{ type: 'text', text: JSON.stringify(r.parsed_output) }] : [],
          };
        },
      },
    },
  };
}
beforeEach(() => { calls = []; ai.setClient(null); });

const answer = (over = {}) => ({
  stop_reason: 'end_turn',
  parsed_output: {
    intent: 'STUDENT_SCHOLARSHIP', urgent: false, reply: 'You may qualify for **AICTE Pragati**.',
    matchedItemIds: ['sch-3', 'made-up-id', 'sch-3'],
    documentChecklist: ['Income certificate'], nextSteps: ['Apply on AICTE portal'],
    sources: [
      { name: 'NSP', url: 'https://scholarships.gov.in' },
      { name: 'Phishing', url: 'https://evil.example.com/apply' },
    ],
    ...over,
  },
});

test('without Claude configured, chat uses the keyword engine', async () => {
  const res = await request(app).post('/api/ai/chat').send({ query: 'flood in my street' });
  assert.equal(res.status, 200);
  assert.equal(res.body.aiMode, 'basic');
  assert.equal(res.body.intentCategory, 'DISASTER_ASSISTANCE');
});

test('Claude request: model, cached catalog prompt, fallbacks, structured output', async () => {
  ai.setClient(fakeClient(() => answer()));
  const res = await request(app).post('/api/ai/chat').send({
    query: 'I am a girl in first year BTech',
    history: [{ role: 'assistant', text: 'Hi!' }, { role: 'user', text: 'hello' }, { role: 'assistant', text: 'How can I help?' }],
  });
  assert.equal(res.status, 200);
  const p = calls[0];
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.match(p.system[0].text, /sch-3/, 'catalog is in the system prompt');
  assert.equal(p.output_config.effort, 'low');
  assert.equal(p.output_config.format.type, 'json_schema');
  const schema = p.output_config.format.schema;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$schema, undefined, 'no $schema key');
  assert.deepEqual(schema.required.sort(), ['documentChecklist', 'intent', 'matchedItemIds', 'nextSteps', 'reply', 'sources', 'urgent']);
  assert.equal(schema.properties.sources.items.additionalProperties, false, 'nested objects are closed too');
  assert.equal(p.thinking, undefined, 'thinking left at the model default');
  assert.equal(p.messages[0].role, 'user', 'leading assistant turn dropped');
  assert.equal(p.messages.at(-1).content, 'I am a girl in first year BTech');

  assert.equal(res.body.aiMode, 'claude');
  assert.deepEqual(res.body.matchedItems.map(i => i.id), ['sch-3'], 'unknown and duplicate ids removed');
  assert.deepEqual(res.body.officialSources.map(s => s.url), ['https://scholarships.gov.in'], 'non-catalog URLs removed');
});

test('signed-in user profile is passed to Claude', async () => {
  ai.setClient(fakeClient(() => answer()));
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'P', email: `p${Date.now()}@nivra.test`, password: 'password123' });
  await agent.patch('/api/auth/me').send({ profile: { category: 'sc', annualIncome: 200000 } });
  await agent.post('/api/ai/chat').send({ query: 'any scholarships?' });
  assert.match(calls[0].messages.at(-1).content, /category SC, family income ₹200000/);
});

test('app language is passed in the user turn, not the cached system prompt', async () => {
  ai.setClient(fakeClient(() => answer()));
  await request(app).post('/api/ai/chat').send({ query: 'scholarship', language: 'te' });
  await request(app).post('/api/ai/chat').send({ query: 'scholarship' });
  assert.match(calls[0].messages.at(-1).content, /Reply in Telugu/);
  assert.equal(calls[0].system[0].text, calls[1].system[0].text, 'system prompt identical across languages (cache hit)');
  assert.doesNotMatch(calls[1].messages.at(-1).content, /Reply in/);
  assert.equal((await request(app).post('/api/ai/chat').send({ query: 'x', language: 'fr' })).status, 400);
});

test('refusals get a safe message instead of an error', async () => {
  ai.setClient(fakeClient(() => ({ stop_reason: 'refusal', parsed_output: null })));
  const res = await request(app).post('/api/ai/chat').send({ query: 'something' });
  assert.equal(res.status, 200);
  assert.equal(res.body.aiMode, 'claude');
  assert.match(res.body.responseText, /can't help/);
});

test('Claude errors fall back to the keyword engine', async () => {
  ai.setClient(fakeClient(() => { throw Object.assign(new Error('overloaded'), { status: 529 }); }));
  const res = await request(app).post('/api/ai/chat').send({ query: 'education loan' });
  assert.equal(res.status, 200);
  assert.equal(res.body.aiMode, 'basic');
  assert.equal(res.body.intentCategory, 'STUDENT_LOAN');
});

test('photo analysis: unavailable without Claude, base64 image when configured', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/guest');

  const off = await agent.post('/api/ai/analyze-image').attach('image', PNG_1PX, 'a.png');
  assert.equal(off.status, 503);
  assert.equal(off.body.available, false);

  ai.setClient(fakeClient(() => ({
    stop_reason: 'end_turn',
    parsed_output: { hazardType: 'flood', severity: 'HIGH', confidence: 'medium', summary: 'Street flooded', recommendedActions: ['Move to higher ground'], peopleAtRisk: false },
  })));
  const on = await agent.post('/api/ai/analyze-image').field('note', 'water rising').attach('image', PNG_1PX, 'a.png');
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(on.body.hazardType, 'flood');
  const img = calls[0].messages[0].content[0];
  assert.equal(img.type, 'image');
  assert.equal(img.source.media_type, 'image/png');
  assert.equal(img.source.data, PNG_1PX.toString('base64'));
  assert.match(calls[0].messages[0].content[1].text, /water rising/);
});

test('photo analysis requires sign-in', async () => {
  const res = await request(app).post('/api/ai/analyze-image').attach('image', PNG_1PX, 'a.png');
  assert.equal(res.status, 401);
});

test('an unexpected intent label degrades to the default instead of failing', async () => {
  ai.setClient(fakeClient(() => answer({ intent: 'SOMETHING_NEW' })));
  const res = await request(app).post('/api/ai/chat').send({ query: 'help' });
  assert.equal(res.body.aiMode, 'claude');
  assert.equal(res.body.intentCategory, 'GENERAL_GUIDANCE');
});

test('malformed model output falls back to the keyword engine', async () => {
  ai.setClient(fakeClient(() => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] })));
  const res = await request(app).post('/api/ai/chat').send({ query: 'education loan' });
  assert.equal(res.status, 200);
  assert.equal(res.body.aiMode, 'basic');
});
