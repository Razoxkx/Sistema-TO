export const clinicalSections = [
  { title: 'Datos personales', description: 'Información para identificar y contactar al usuario.', fields: [
    { key: 'name', label: 'Nombre completo', type: 'text', max: 200, required: true },
    { key: 'age', label: 'Edad', type: 'number', required: true },
    { key: 'address', label: 'Dirección', type: 'text', max: 500 },
  ] },
  { title: 'Antecedentes de salud', description: 'Antecedentes relevantes para la atención.', fields: [
    { key: 'medicalHistory', label: 'Antecedentes médicos', max: 5000 },
    { key: 'medications', label: 'Uso de medicamentos', max: 5000 },
    { key: 'chronicConditions', label: 'Enfermedades crónicas', max: 5000 },
  ] },
  { title: 'Vida diaria', description: 'Actividades habituales y dificultades observadas.', fields: [
    { key: 'routines', label: 'Rutinas', max: 5000 },
    { key: 'visibleDifficulties', label: 'Dificultades visibles', max: 5000 },
  ] },
  { title: 'Entorno', description: 'Contexto familiar y características de la vivienda.', fields: [
    { key: 'familyEnvironment', label: 'Entorno familiar', max: 5000 },
    { key: 'housingObservation', label: 'Observación de vivienda', max: 5000 },
  ] },
  { title: 'Intervención', description: 'Aspectos que se abordarán durante el proceso terapéutico.', fields: [
    { key: 'goals', label: 'Objetivos a trabajar', max: 5000 },
    { key: 'skillsToReinforce', label: 'Habilidades a reforzar', max: 5000 },
  ] },
];
export const clinicalFields = clinicalSections.flatMap(section => section.fields);
export const emptyClinicalRecord = () => Object.fromEntries(clinicalFields.map(field => [field.key, '']));
