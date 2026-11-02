export const sessionFields = [
  { key: 'activities', label: 'Actividades realizadas', placeholder: 'Describe lo que se hizo durante la sesión', required: true, max: 10000 },
  { key: 'objectives', label: 'Objetivos trabajados', placeholder: 'Objetivos abordados durante la atención', max: 5000 },
  { key: 'observations', label: 'Observaciones y respuesta del usuario', placeholder: 'Avances, dificultades y respuesta a las actividades', max: 10000 },
  { key: 'nextSteps', label: 'Acuerdos y próximos pasos', placeholder: 'Indicaciones y aspectos para la próxima sesión', max: 5000 },
];
export const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const maxSessionAmount = 999999999;
export const emptySession = () => ({ title: '', time: '', date: localDate(), amount: '', ...Object.fromEntries(sessionFields.map(field => [field.key, ''])) });
