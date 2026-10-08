// frontend/src/lib/items.js — small helpers shared by cards that show catalog items
const cache = new Map();

// Official link for a catalog id, from items this session has already loaded
export function rememberItems(items) {
  for (const i of items || []) cache.set(i.id, i.officialLink || i.officialSource || null);
}
export const findItemLink = (id) => (id ? cache.get(id) || null : null);

// Scholarships no longer carry invented deadlines — show the usual window instead
export function deadlineText(item) {
  if (item?.deadline) {
    const d = new Date(`${item.deadline}T00:00:00`);
    return isNaN(d) ? item.deadline : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return null;
}
