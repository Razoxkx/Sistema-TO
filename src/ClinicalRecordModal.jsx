import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ClipboardList, Pencil, Plus, Save, X } from 'lucide-react';
import { clinicalSections } from '../shared/clinical-fields';
import { emptySession, maxSessionAmount, sessionFields } from '../shared/session-fields';
import { lockBodyScroll } from './modal-scroll';
import { ClinicalNotes } from './ClinicalNotes';
import { sessionLabel, sessionName } from '../shared/scheduling';
import { PlansPanel } from './PlansPanel';
import { ReportsPanel } from './ReportsPanel';
import { useViewData } from './ViewData';

const dateLabel = date => new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date(`${date}T12:00:00Z`));
const amountLabel = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
function ServiceError({ error, retry }) {
  return error && <div className="error-message" role="alert"><p>{error.message}</p>{retry && <button type="button" onClick={retry}>Volver a intentar</button>}</div>;
}
function SessionForm({ session, onSave, onCancel, onDirtyChange, onBusyChange }) {
  const [initial] = useState(() => session ? { title: session.title || '', time: session.time || '', date: session.date, amount: session.amount == null ? '' : String(session.amount), ...Object.fromEntries(sessionFields.map(field => [field.key, session[field.key] || ''])) } : emptySession());
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const dirty = JSON.stringify(initial) !== JSON.stringify(values);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!saving && error?.fields) ref.current?.elements.namedItem(Object.keys(error.fields)[0])?.focus();
  }, [error, saving]);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); onBusyChange(true); setError(null);
    try { await onSave({ ...values, amount: Number(values.amount), ...(session ? { version: session.version } : {}) }); }
    catch (err) { setError(err); }
    finally { setSaving(false); onBusyChange(false); }
  }
  function field(key, label, content) {
    return <div className="clinical-field" key={key}><div className="field-surface" data-invalid={Boolean(error?.fields?.[key])} data-filled={String(values[key]).trim() !== ''}><label htmlFor={`session-${key}`}>{label}</label><div className="field-editor">{content}</div></div>{error?.fields?.[key] && <span className="field-error" id={`session-${key}-error`}>{error.fields[key]}</span>}</div>;
  }
  const attrs = key => ({ id: `session-${key}`, name: key, value: values[key], onChange: event => setValues(v => ({ ...v, [key]: event.target.value })), 'aria-invalid': Boolean(error?.fields?.[key]), 'aria-describedby': error?.fields?.[key] ? `session-${key}-error` : undefined });
  return <form ref={ref} className="session-form" onSubmit={submit} aria-busy={saving}>
    <p className="form-note">Registra lo trabajado durante la atención. Puedes elegir una fecha anterior. Los campos con * son obligatorios.</p>
    <fieldset disabled={saving} className="session-fields">
      {field('title', 'Nombre de la sesión', <input {...attrs('title')} maxLength={200} placeholder="Ej. Sesión número 5"/>)}
      {session?.status === 'scheduled' && <p className="report-callout">Esta sesión está programada. Al guardar la atención se marcará como realizada.</p>}
      <div className="session-meta-fields">
        {field('date', 'Fecha de la sesión *', <input {...attrs('date')} onInput={attrs('date').onChange} type="date" required min="1900-01-01" max="2100-12-31"/>)}
        {field('time', !session || session.time ? 'Hora de la sesión *' : 'Hora de la sesión', <input {...attrs('time')} onInput={attrs('time').onChange} type="time" required={!session || Boolean(session.time)}/>)}
        {field('amount', 'Valor de la sesión *', <><span className="field-unit" aria-hidden="true">$</span><input {...attrs('amount')} type="number" inputMode="numeric" required min="0" max={maxSessionAmount} step="1" placeholder="20000"/><span className="field-unit">CLP</span></>)}
      </div>
      {sessionFields.map(item => field(item.key, `${item.label}${item.required ? ' *' : ''}`, <ClinicalNotes {...attrs(item.key)} rows={2} required={item.required} maxLength={item.max} placeholder={item.placeholder}/>))}
    </fieldset>
    <ServiceError error={error}/>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancelar</button><button className="primary-button" disabled={saving}><Save size={16} aria-hidden="true"/>{saving ? 'Guardando…' : session?.status === 'scheduled' ? 'Registrar atención' : session ? 'Guardar cambios' : 'Guardar sesión'}</button></div>
  </form>;
}
function SessionHistory({ recordId, service, refresh, onEdit }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const { data: result, error, loading } = useViewData(service, JSON.stringify(['sessions', recordId, page]), signal => service.sessions(recordId, { page, signal }), { refresh: `${retry}:${refresh}` });
  return <section aria-label="Historial de sesiones" aria-busy={loading}>
    {loading && !result && <p role="status" className="data-status">Cargando sesiones…</p>}
    <ServiceError error={error} retry={() => setRetry(v => v + 1)}/>
    {result && <>
      <p className="session-count">{result.total} {result.total === 1 ? 'sesión registrada' : 'sesiones registradas'}</p>
      {result.sessions.length ? <div className="session-history">{result.sessions.map(session => <article className="session-entry" key={session.id}>
        <div className="session-entry-heading"><h3><CalendarDays size={17} aria-hidden="true"/><span>{sessionName(session)}</span></h3><p className="session-amount">{session.amount == null ? session.status === 'scheduled' ? 'Por realizar' : 'Valor sin registrar' : <><span className="sr-only">Valor de la sesión: </span>{amountLabel(session.amount)}<span className="session-currency">CLP</span></>}</p></div>
        <p className="session-calendar-label">{dateLabel(session.date)}{session.time ? ` · ${session.time}` : ' · Sin hora asignada'} · {session.status === 'scheduled' ? 'Programada' : 'Realizada'}</p>
        <button className="back-button session-edit-button" onClick={() => onEdit(session.id)} aria-label={`${session.status === 'scheduled' ? 'Registrar atención de' : 'Editar sesión'} ${sessionLabel(session)}`}><Pencil size={15} aria-hidden="true"/> {session.status === 'scheduled' ? 'Registrar atención' : 'Editar sesión'}</button>
        <dl>{sessionFields.filter(field => session[field.key]).map(field => <div key={field.key}><dt>{field.label}</dt><dd>{session[field.key]}</dd></div>)}</dl>
      </article>)}</div> : <div className="empty-sessions"><CalendarDays size={28} aria-hidden="true"/><h3>Aún no hay sesiones registradas</h3><p>Usa «Nueva sesión» para registrar la primera atención.</p></div>}
      {result.total > result.pageSize && <div className="pagination"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page} de {Math.ceil(result.total / result.pageSize)}</span><button className="secondary-button" disabled={page * result.pageSize >= result.total} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>}
    </>}
  </section>;
}
function SessionEditor({ recordId, sessionId, service, ...props }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController(); let active = true;
    setSession(null); setError(null);
    service.getSession(recordId, sessionId, controller.signal).then(data => { if (active) setSession(data.session); }).catch(err => { if (active && err.name !== 'AbortError') setError(err); });
    return () => { active = false; controller.abort(); };
  }, [recordId, sessionId, service, retry]);
  if (!sessionId) return <SessionForm {...props}/>;
  if (error) return <ServiceError error={error} retry={() => setRetry(v => v + 1)}/>;
  if (!session) return <p className="data-status" role="status">Cargando sesión…</p>;
  return <SessionForm key={session.id} session={session} {...props}/>;
}

export function ClinicalRecordModal({ id, record, loading, error, retry, creatingSession, sessionId, activeView, reportId, reportEditing, reportService, planId, planEditing, planService, navigate, onDirtyChange, service, notice, setNotice }) {
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const scrollRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const trigger = document.activeElement?.matches('.user-card') ? document.activeElement : document.querySelector(`.user-card[href="#usuarios/${id}"]`);
    const unlock = lockBodyScroll();
    const dialog = dialogRef.current;
    dialog.showModal();
    titleRef.current?.focus();
    return () => { dialog.close(); unlock(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => { if (creatingSession) titleRef.current?.focus(); scrollRef.current?.scrollTo(0, 0); }, [creatingSession, sessionId, activeView, reportEditing, planEditing]);
  const returnToRecord = () => navigate(`/usuarios/${id}`);
  const close = () => { if (!saving) navigate('/usuarios'); };
  async function saveSession(values) {
    if (sessionId) await service.updateSession(id, sessionId, values);
    else await service.createSession(id, values);
    onDirtyChange(false); setRefresh(v => v + 1); setNotice(sessionId ? 'Sesión actualizada correctamente.' : 'Sesión guardada correctamente.');
    navigate(`/usuarios/${id}/sesiones`, true);
  }
  return <dialog ref={dialogRef} className="clinical-modal" aria-labelledby="clinical-modal-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== dialogRef.current) return;
    const rect = dialogRef.current.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <header className="clinical-modal-header"><div className="modal-title-row"><div><p className="modal-eyebrow"><ClipboardList size={14} aria-hidden="true"/>{creatingSession ? 'Registro de atención' : 'Ficha clínica'}</p><h2 ref={titleRef} tabIndex={-1} id="clinical-modal-title">{creatingSession ? sessionId ? 'Editar sesión' : 'Nueva sesión' : record?.name || 'Ficha clínica'}</h2>{record && <p className="modal-subtitle">{creatingSession ? record.name : `${record.age} años`}</p>}</div><button className="icon-button" aria-label="Cerrar ficha clínica" onClick={close} disabled={saving}><X size={21}/></button></div>
      {record && !creatingSession && <div className="modal-record-actions"><button className="secondary-button" disabled={saving} onClick={() => { setNotice(''); navigate(`/usuarios/${id}/editar`); }}><Pencil size={16} aria-hidden="true"/>Editar ficha</button><button className="primary-button" disabled={saving} onClick={() => { setNotice(''); navigate(`/usuarios/${id}/sesion`); }}><Plus size={17} aria-hidden="true"/>Nueva sesión</button></div>}
      {creatingSession ? <button className="back-button" disabled={saving} onClick={returnToRecord}><ArrowLeft size={16} aria-hidden="true"/>Volver a la ficha</button> : record && <nav className="record-tabs" aria-label="Contenido de la ficha"><button disabled={saving} aria-pressed={activeView === 'record'} onClick={() => { setNotice(''); navigate(`/usuarios/${id}`); }}>Ficha clínica</button><button disabled={saving} aria-pressed={activeView === 'sessions'} onClick={() => { setNotice(''); navigate(`/usuarios/${id}/sesiones`); }}>Sesiones</button><button disabled={saving} aria-pressed={activeView === 'reports'} onClick={() => { setNotice(''); navigate(`/usuarios/${id}/informes`); }}>Informes</button><button disabled={saving} aria-pressed={activeView === 'plans'} onClick={() => { setNotice(''); navigate(`/usuarios/${id}/planificaciones`); }}>Planificaciones</button></nav>}
    </header>
    <div className="clinical-modal-body" ref={scrollRef}>
      {notice && <p className="save-notice" role="status"><Check size={16} aria-hidden="true"/>{notice}</p>}
      {loading && <p className="data-status" role="status">Cargando ficha clínica…</p>}
      <ServiceError error={error} retry={retry}/>
      {record && !loading && !error && (creatingSession ? <SessionEditor key={sessionId || 'new'} recordId={id} sessionId={sessionId} service={service} onSave={saveSession} onCancel={returnToRecord} onDirtyChange={onDirtyChange} onBusyChange={setSaving}/> : activeView === 'plans' ? <PlansPanel id={id} planId={planId} editing={planEditing} navigate={navigate} onDirtyChange={onDirtyChange} onBusyChange={setSaving} service={planService}/> : activeView === 'reports' ? <ReportsPanel id={id} reportId={reportId} editing={reportEditing} navigate={navigate} onDirtyChange={onDirtyChange} onBusyChange={setSaving} service={reportService}/> : activeView === 'sessions' ? <SessionHistory recordId={id} service={service} refresh={refresh} onEdit={sessionId => { setNotice(''); navigate(`/usuarios/${id}/sesion/${sessionId}`); }}/> : <div className="clinical-detail modal-clinical-detail">
        {clinicalSections.map(section => <section className="clinical-section" key={section.title}><h3>{section.title}</h3><dl>{section.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.key === 'age' ? `${record.age} años` : record[field.key] || <span className="missing-value">Sin registrar</span>}</dd></div>)}</dl></section>)}
      </div>)}
    </div>
  </dialog>;
}
