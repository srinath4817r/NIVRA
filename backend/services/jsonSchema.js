// backend/services/jsonSchema.js — zod schema → the JSON-schema subset the Claude API accepts
// (structured outputs). Mirrors what the SDK's own zod helper sends, without importing the
// helper's sub-path: Vercel compiles our code with rolldown and keeps only exact package names
// external, so a sub-path import would pull a second, mismatched copy of zod into the bundle.
const { z } = require('zod');

function strict(node) {
  const rest = { ...node };
  const out = {};
  const take = (key) => { const v = rest[key]; delete rest[key]; return v; };

  const type = take('type');
  const anyOf = take('anyOf');
  if (Array.isArray(anyOf)) out.anyOf = anyOf.map(strict);
  else if (type === undefined) throw new Error('schema node needs a type');
  else out.type = type;

  const description = take('description');
  if (description !== undefined) out.description = description;
  delete rest.$schema;
  delete rest.title;

  if (type === 'object') {
    out.properties = Object.fromEntries(Object.entries(take('properties') || {}).map(([k, v]) => [k, strict(v)]));
    delete rest.additionalProperties;
    out.additionalProperties = false;
    const required = take('required');
    if (required) out.required = required;
  } else if (type === 'array') {
    const items = take('items');
    if (items) out.items = strict(items);
  }

  // Anything else (enum, min/max, patterns…) isn't enforced by the API; keep it as a hint for the
  // model in the description and validate with zod after parsing.
  if (Object.keys(rest).length) {
    const hint = '{' + Object.entries(rest).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ') + '}';
    out.description = out.description ? `${out.description}\n\n${hint}` : hint;
  }
  return out;
}

const toStrictSchema = (zodSchema) => strict(z.toJSONSchema(zodSchema));

module.exports = { toStrictSchema };
