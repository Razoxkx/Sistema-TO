import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Search, Users, MapPin, AlertCircle, Save, ClipboardList, HeartPulse, Activity, House, Target } from 'lucide-react';
import { clinicalSections, emptyClinicalRecord } from '../shared/clinical-fields';
import { clinicalApi } from './api';
import './clinical-users.css';
import { ClinicalNotes } from './ClinicalNotes';
import { ClinicalRecordModal } from './ClinicalRecordModal';
import { useViewData } from './ViewData';

const sectionIcons = { 'Datos personales': Users, 'Antecedentes de salud': HeartPulse, 'Vida diaria': Activity, 'Entorno': House, 'Intervención': Target };
const fieldHints = { name: 'Nombre y apellidos', age: '0', address: 'Calle, número y comuna', medicalHistory: 'Antecedentes relevantes', medications: 'Medicamentos y uso indicado', chronicConditions: 'Condiciones registradas', routines: 'Actividades y hábitos cotidianos', visibleDifficulties: 'Dificultades observadas', familyEnvironment: 'Composición y apoyo familiar', housingObservation: 'Características de la vivienda', goals: 'Objetivos de la intervención', skillsToReinforce: 'Habilidades a desarrollar' };
function ErrorMessage({ error, retry }) {
  return error && <div className="error-message" role="alert"><p>{error.message}</p>
    {error.status === 401 ? <button onClick={() => location.reload()}>Volver a iniciar sesión</button> : retry && <button onClick={retry}>Volver a intentar</button>}
  </div>;
}

function ClinicalForm({ record, onSave, onCancel, onDirtyChange }) {
  const [values, setValues] = useState(() => ({ ...emptyClinicalRecord(), ...record }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const formRef = useRef(null);
  useEffect(() => {
    const key = Object.keys(fields)[0];
    if (!saving && key) formRef.current?.elements.namedItem(key)?.focus();
  }, [fields, saving]);
  const dirty = JSON.stringify(values) !== JSON.stringify({ ...emptyClinicalRecord(), ...record });
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(null); setFields({});
    try { await onSave({ ...values, age: Number(values.age) }); }
    catch (err) {
      setError(err); setFields(err.fields || {});

    } finally { setSaving(false); }
  }
  return <form ref={formRef} className="clinical-form" onSubmit={submit} aria-busy={saving}>
    <div className="form-note"><ClipboardList size={15} aria-hidden="true"/><span>Completa la información del usuario. Los campos con * son obligatorios.</span></div>
    <fieldset className="clinical-form-fields" disabled={saving}>
      {clinicalSections.map(section => <section className="clinical-section" key={section.title} aria-labelledby={`section-${section.fields[0].key}`}>
        <div className="section-heading">{(() => { const Icon = sectionIcons[section.title]; return <Icon size={17} aria-hidden="true"/>; })()}<h2 id={`section-${section.fields[0].key}`}>{section.title}</h2></div>
        <div className={`clinical-fields${section.title === 'Datos personales' ? ' personal-fields' : ''}`}>
          {section.fields.map(field => <div className={`clinical-field field-${field.key}`} key={field.key}>
            <div className="field-surface" data-invalid={Boolean(fields[field.key])} data-filled={String(values[field.key]).trim() !== ''}>
            <label htmlFor={field.key}>{field.label}{field.required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
            <div className="field-editor">
            {field.type ? <input id={field.key} name={field.key} type={field.type} placeholder={fieldHints[field.key]} value={values[field.key]} required={field.required} maxLength={field.max} min={field.type === 'number' ? 0 : undefined} max={field.type === 'number' ? 130 : undefined} step={field.type === 'number' ? 1 : undefined} autoComplete={field.key === 'name' ? 'off' : field.key === 'address' ? 'street-address' : undefined} onChange={event => setValues(v => ({ ...v, [field.key]: event.target.value }))} aria-invalid={Boolean(fields[field.key])} aria-describedby={fields[field.key] ? `${field.key}-error` : undefined}/>
              : <ClinicalNotes id={field.key} name={field.key} rows={2} placeholder={fieldHints[field.key]} maxLength={field.max} value={values[field.key]} onChange={event => setValues(v => ({ ...v, [field.key]: event.target.value }))} aria-invalid={Boolean(fields[field.key])} aria-describedby={fields[field.key] ? `${field.key}-error` : undefined}/>}
            {field.key === 'age' && <span className="field-unit" aria-hidden="true">años</span>}
            </div></div>
            {fields[field.key] && <span className="field-error" id={`${field.key}-error`}><AlertCircle size={13} aria-hidden="true"/>{fields[field.key]}</span>}
          </div>)}
        </div>
      </section>)}
    </fieldset>
    <ErrorMessage error={error}/>
    <div className="form-actions"><span className="save-context">{record.id ? 'Edición de ficha clínica' : 'Nueva ficha clínica'}</span><div className="form-action-buttons"><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}><Save size={16} aria-hidden="true"/>{saving ? 'Guardando…' : 'Guardar ficha clínica'}</button></div></div>
  </form>;
}

export function ClinicalUsers({ route, navigate, onDirtyChange, service = clinicalApi, reportService, planService }) {
  const [, , id, action] = route.split('/');
  const creating = id === 'nueva';
  const editing = Boolean(id && !creating && action === 'editar');
  const modal = Boolean(id && !creating && !editing);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [listRetry, setListRetry] = useState(0);
  const { data: result, loading: listLoading, error: listError } = useViewData(service, JSON.stringify(['users', search, page]), signal => service.list({ q: search, page, signal }), { refresh: listRetry, delay: search ? 250 : 0 });
  const [notice, setNotice] = useState('');
  const titleRef = useRef(null);
  const previousModal = useRef(false);
  useEffect(() => {
    if (!modal && !previousModal.current) titleRef.current?.focus();
    previousModal.current = modal;
  }, [route, modal]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setError(null); setRecord(null); setLoading(Boolean(id && !creating));
    if (id && !creating) service.get(id, controller.signal).then(data => { if (active) setRecord(data.record); }).catch(err => { if (active && err.name !== 'AbortError') setError(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [id, creating, retry, service]);
  async function save(values) {
    const saved = await service.save(creating ? null : id, values);
    onDirtyChange(false); setRecord(saved.record);
    setNotice(creating ? 'Ficha clínica creada correctamente.' : 'Cambios guardados correctamente.');
    navigate(`/usuarios/${saved.record.id}`, true);
    setRetry(v => v + 1); setListRetry(v => v + 1);
  }
  return <div className="clinical-users" aria-busy={listLoading && !creating && !editing}>
    {creating || editing ? <>
      <button className="back-button" onClick={() => navigate(editing ? `/usuarios/${id}` : '/usuarios')}><ArrowLeft size={16}/>{editing ? 'Volver a la ficha' : 'Volver a usuarios'}</button>
      <div className="page-heading"><h1 ref={titleRef} tabIndex={-1}>{creating ? 'Nueva ficha clínica' : 'Editar ficha clínica'}</h1></div>
      {loading && <p className="data-status" role="status">Cargando ficha clínica…</p>}
      <ErrorMessage error={error} retry={() => setRetry(v => v + 1)}/>
      {!loading && !error && (creating || record) && <ClinicalForm key={`${id}-${record?.version || 0}`} record={record || {}} onSave={save} onCancel={() => navigate(editing ? `/usuarios/${id}` : '/usuarios')} onDirtyChange={onDirtyChange}/>}
    </> : <>
      <div className="page-heading"><div><h1 ref={titleRef} tabIndex={-1}>Usuarios</h1><p>Registra y consulta las fichas clínicas de tus usuarios.</p></div><button className="primary-button" onClick={() => { setNotice(''); navigate('/usuarios/nueva'); }}><Plus size={17}/>Nuevo usuario</button></div>
      <div className="list-toolbar"><div className="search-control"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar usuario por nombre" placeholder="Buscar por nombre" maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/></div>{result && <span>{result.total} {result.total === 1 ? 'usuario' : 'usuarios'}</span>}</div>
      {listLoading && !result && <p className="data-status" role="status">Cargando usuarios…</p>}
      <ErrorMessage error={listError} retry={() => setListRetry(v => v + 1)}/>
      {result && <>
        {result.records.length ? <div className="user-cards">{result.records.map(row => <a key={row.id} className="user-card" href={`#usuarios/${row.id}`} onClick={event => { event.preventDefault(); setNotice(''); navigate(`/usuarios/${row.id}`); }} aria-label={`Abrir ficha clínica de ${row.name}`}>
          <div className="user-card-heading"><span className="user-card-avatar" aria-hidden="true">{row.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><h2>{row.name}</h2><span>{row.age} años</span></div></div>
          <p className="user-card-address"><MapPin size={15} aria-hidden="true"/><span>{row.address || 'Sin dirección registrada'}</span></p>
          <div className="user-card-footer"><span>Abrir ficha clínica</span><ChevronRight size={17} aria-hidden="true"/></div>
        </a>)}</div> : <div className="empty-users"><Users size={28} strokeWidth={1.5}/><h2>{search ? 'No encontramos coincidencias' : 'Aún no hay usuarios registrados'}</h2><p>{search ? 'Prueba con otro nombre.' : 'Crea la primera ficha clínica para comenzar.'}</p>{!search && <button className="secondary-button" onClick={() => navigate('/usuarios/nueva')}>Crear ficha clínica</button>}</div>}
        {result.total > result.pageSize && <div className="pagination"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page} de {Math.ceil(result.total / result.pageSize)}</span><button className="secondary-button" disabled={page * result.pageSize >= result.total} onClick={() => setPage(v => v + 1)}>Siguiente</button></div>}
      </>}
    </>}
    {modal && <ClinicalRecordModal key={id} id={id} record={record} loading={loading} error={error} retry={() => setRetry(v => v + 1)} planId={route.split('/')[4]} planEditing={route.split('/')[5] === 'editar'} planService={planService} activeView={action === 'planificaciones' ? 'plans' : action === 'informes' ? 'reports' : action === 'sesiones' ? 'sessions' : 'record'} reportId={route.split('/')[4]} reportEditing={route.split('/')[5] === 'editar'} reportService={reportService} creatingSession={action === 'sesion'} sessionId={route.split('/')[4]} navigate={navigate} onDirtyChange={onDirtyChange} service={service} notice={notice} setNotice={setNotice}/>}
  </div>;
}
