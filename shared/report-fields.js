export const reportFields = [
  { key: 'summary', label: 'Resumen del proceso' },
  { key: 'activities', label: 'Actividades realizadas' },
  { key: 'objectives', label: 'Objetivos trabajados' },
  { key: 'progress', label: 'Avances observados' },
  { key: 'difficulties', label: 'Dificultades registradas' },
  { key: 'nextSteps', label: 'Acuerdos y próximos pasos' },
  { key: 'limitations', label: 'Información faltante y límites del informe' },
];
export const maxReportSessions = 200;
export const maxReportText = 8000;
export const validReportDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export function validateReportContent(content, sourceCount) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  return Object.keys(content).length === reportFields.length && reportFields.every(({ key }) => {
    const section = content[key];
    return section && typeof section.text === 'string' && section.text.trim().length > 0 && section.text.length <= maxReportText && Array.isArray(section.sources) && section.sources.length <= sourceCount && section.sources.every(number => Number.isInteger(number) && number >= 1 && number <= sourceCount) && new Set(section.sources).size === section.sources.length;
  });
}
