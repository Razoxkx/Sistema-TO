export const currentMonth = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
};
export const validMonth = value => typeof value === 'string' && /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value);
export function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
