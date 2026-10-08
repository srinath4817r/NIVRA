// backend/services/eligibility.js — match a user's profile against catalog criteria
// Each rule returns pass / fail / unknown (question not answered). An item is
//   eligible     — every rule passes
//   likely       — every rule the checker can test passes; one condition must be confirmed on the portal
//   maybe        — nothing fails, but some answers are missing
//   not_eligible — at least one rule fails
// Only the main published conditions are encoded; the UI always says to confirm on the portal.
const content = require('../data/content');

const EDUCATION_LABEL = {
  school: 'school (up to Class 10)', 'class11-12': 'Class 11–12', diploma: 'a diploma', ug: 'an undergraduate degree', pg: 'a postgraduate degree', none: 'not studying',
};
const CATEGORY_LABEL = { general: 'General', obc: 'OBC', sc: 'SC', st: 'ST', ews: 'EWS' };
const inr = (n) => `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} lakh`;
const listOf = (arr, map = (x) => x) => arr.map(map).join(' or ');

function rules(criteria, p) {
  const out = [];
  const has = (k) => p[k] !== undefined && p[k] !== null && p[k] !== '';

  if (criteria.minAge != null || criteria.maxAge != null) {
    const range = criteria.maxAge != null
      ? `Age ${criteria.minAge ?? 0}–${criteria.maxAge}`
      : `Age ${criteria.minAge}+`;
    out.push({
      rule: range,
      result: !has('age') ? 'unknown'
        : (p.age >= (criteria.minAge ?? 0) && p.age <= (criteria.maxAge ?? Infinity)) ? 'pass' : 'fail',
    });
  }
  if (criteria.genders?.length) {
    out.push({
      rule: `For ${listOf(criteria.genders, g => (g === 'female' ? 'women / girls' : g))}`,
      result: !has('gender') ? 'unknown' : criteria.genders.includes(p.gender) ? 'pass' : 'fail',
    });
  }
  if (criteria.categories?.length) {
    out.push({
      rule: `${listOf(criteria.categories, c => CATEGORY_LABEL[c])} category`,
      result: !has('category') ? 'unknown' : criteria.categories.includes(p.category) ? 'pass' : 'fail',
    });
  }
  if (criteria.maxIncome != null) {
    out.push({
      rule: `Family income up to ${inr(criteria.maxIncome)} a year`,
      result: !has('annualIncome') ? 'unknown' : p.annualIncome <= criteria.maxIncome ? 'pass' : 'fail',
    });
  }
  if (criteria.educationLevels?.length) {
    out.push({
      rule: `Studying ${listOf(criteria.educationLevels, l => EDUCATION_LABEL[l])}`,
      result: !has('educationLevel') ? 'unknown' : criteria.educationLevels.includes(p.educationLevel) ? 'pass' : 'fail',
    });
  }
  if (criteria.occupations?.length) {
    out.push({
      rule: `Work: ${listOf(criteria.occupations)}`,
      result: !has('occupation') ? 'unknown' : criteria.occupations.includes(p.occupation) ? 'pass' : 'fail',
    });
  }
  if (criteria.disability) {
    out.push({
      rule: 'Person with a disability (40% or more)',
      result: !has('disability') ? 'unknown' : p.disability ? 'pass' : 'fail',
    });
  }
  if (criteria.states?.length) {
    const norm = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
    out.push({
      rule: `Resident of ${criteria.states.length > 3 ? 'the listed states' : listOf(criteria.states)}`,
      result: !has('state') ? 'unknown' : criteria.states.map(norm).includes(norm(p.state)) ? 'pass' : 'fail',
    });
  }
  if (criteria.otherConditions) {
    out.push({ rule: criteria.otherConditions, result: 'confirm' });
  }
  return out;
}

function evaluate(item, profile = {}) {
  const checks = rules(item.criteria || {}, profile);
  const status = checks.some(c => c.result === 'fail') ? 'not_eligible'
    : checks.some(c => c.result === 'unknown') || checks.length === 0 ? 'maybe'
      : checks.some(c => c.result === 'confirm') ? 'likely'
        : 'eligible';
  return { status, checks };
}

const ALL = () => [
  ...content.scholarships.map(i => ({ kind: 'scholarship', item: i })),
  ...content.educationLoans.map(i => ({ kind: 'loan', item: i })),
  ...content.governmentSchemes.map(i => ({ kind: 'scheme', item: i })),
];

const RANK = { eligible: 0, likely: 1, maybe: 2, not_eligible: 3 };

function checkAll(profile) {
  return ALL()
    .map(({ kind, item }) => {
      const { status, checks } = evaluate(item, profile);
      const unknown = checks.filter(c => c.result === 'unknown').length;
      return { kind, item, status, checks, unknown };
    })
    // eligible first, then "maybe" with the fewest missing answers
    .sort((a, b) => RANK[a.status] - RANK[b.status] || a.unknown - b.unknown);
}

module.exports = { evaluate, checkAll };
