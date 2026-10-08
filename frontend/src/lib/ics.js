// frontend/src/lib/ics.js — calendar file for an application deadline (works with Google, Apple, Outlook)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const ymd = (iso) => iso.replace(/-/g, '');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// lines longer than 75 octets must be folded (RFC 5545)
const fold = (line) => line.length <= 74 ? line : line.match(/.{1,73}/g).join('\r\n ');

export function deadlineIcs({ id, title, deadline, referenceNo, url }) {
  const next = new Date(`${deadline}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10);
  const description = [
    `Application deadline for ${title}.`,
    referenceNo && referenceNo !== 'Not yet applied' ? `Reference: ${referenceNo}` : null,
    url ? `Portal: ${url}` : null,
    'Confirm the date on the official portal. Reminder from NIVRA.',
  ].filter(Boolean).join('\n');

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIVRA//Deadlines//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:nivra-${id}-${ymd(deadline)}@nivra`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${ymd(deadline)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${esc(`Deadline: ${title}`)}`,
    `DESCRIPTION:${esc(description)}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${title} deadline in 3 days`)}`, 'TRIGGER:-P3D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${title} deadline tomorrow`)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(tracker, url) {
  const blob = new Blob([deadlineIcs({ ...tracker, url })], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${tracker.title.replace(/[^\w]+/g, '-').slice(0, 40)}-deadline.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// whole days from today (local) until an ISO date
export function daysUntil(iso) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d - today) / 86400000);
}
