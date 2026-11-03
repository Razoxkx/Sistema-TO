import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, FileText, Pencil, Plus, Save } from 'lucide-react';
import { reportApi } from './api';
import { maxReportText, reportFields, validateReportContent } from '../shared/report-fields';
import { ClinicalNotes } from './ClinicalNotes';
import { useViewData } from './ViewData';
import './reports.css';
const dateLabel = value => new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const periodLabel = report => `${dateLabel(report.periodStart)} al ${dateLabel(report.periodEnd)}`;
function Failure({ error, retry }) { return error && <div className="error-message" role="alert"><p>{error.message}</p>{retry && <button type="button" onClick={retry}>Volver a intentar</button>}</div>; }
function Sources({ sources }) {
  return <details className="report-sources"><summary>Ver sesiones de respaldo ({sources.length})</summary><p>Estas son las notas utilizadas como respaldo.</p>{sources.map(source => <details key={source.number} className="report-source"><summary>Sesión {source.number} · {dateLabel(source.date)}</summary><dl>{[['activities', 'Actividades'], ['objectives', 'Objetivos'], ['observations', 'Observaciones'], ['nextSteps', 'Próximos pasos']].filter(([key]) => source[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{source[key]}</dd></div>)}</dl></details>)}</details>;
}
function ReportCreate({ id, service, enabled, onGenerated, onCancel, onBusyChange }) {
  const [mode, setMode] = useState('all');
  const [range, setRange] = useState({ from: '', to: '' });
  const [preview, setPreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const selection = mode === 'all' ? {} : range;
  const selectionKey = JSON.stringify(selection);
  const valid = mode === 'all' || (range.from && range.to && range.from <= range.to);
  useEffect(() => { setPreview(null); setConsent(false); setError(null); }, [selectionKey]);
  async function review(event) {
    event.preventDefault(); setPreview(null); setConsent(false); setBusy(true); setError(null);
    try { setPreview(await service.sources(id, selection)); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (generating || !consent || !preview || !enabled) return;
    setGenerating(true); onBusyChange(true); setError(null);
    try { const data = await service.generate(id, { ...selection, consent: true, digest: preview.digest }); if (alive.current) onGenerated(data.report); }
    catch (err) { setError(err); if (err.status === 409) { setPreview(null); setConsent(false); } }
    finally { setGenerating(false); onBusyChange(false); }
  }
  return <section aria-labelledby="new-report-title"><h3 id="new-report-title" className="report-view-title">Nuevo informe</h3>
    {!enabled && <p className="report-callout" role="status">La generación con IA requiere configurar la clave de OpenAI en el servidor.</p>}
    <form onSubmit={review}><fieldset className="report-selection" disabled={busy || generating}><legend>Sesiones a incluir</legend><div className="report-radio-row"><label><input type="radio" name="report-range" checked={mode === 'all'} onChange={() => setMode('all')}/>Todas las sesiones realizadas</label><label><input type="radio" name="report-range" checked={mode === 'range'} onChange={() => setMode('range')}/>Rango de fechas</label></div>
      {mode === 'range' && <div className="session-meta-fields">{[['from', 'Desde'], ['to', 'Hasta']].map(([key, label]) => <div className="field-surface" key={key}><label htmlFor={`report-${key}`}>{label}</label><div className="field-editor"><input id={`report-${key}`} type="date" required min="1900-01-01" max="2100-12-31" value={range[key]} onInput={event => setRange(v => ({ ...v, [key]: event.target.value }))} onChange={event => setRange(v => ({ ...v, [key]: event.target.value }))}/></div></div>)}</div>}
      <button className="secondary-button" disabled={!valid || busy || generating}>{busy ? 'Revisando sesiones…' : 'Revisar sesiones'}</button></fieldset></form>
    {preview && <div className="report-preview"><h4>{preview.sources.length} {preview.sources.length === 1 ? 'sesión seleccionada' : 'sesiones seleccionadas'}</h4><p>{dateLabel(preview.sources[0].date)} al {dateLabel(preview.sources.at(-1).date)}</p><Sources sources={preview.sources}/><p className="report-privacy">Se enviarán a OpenAI las fechas y notas seleccionadas. No se añaden los datos de identificación de la ficha ni los valores de las sesiones. Revisa las notas antes de enviarlas.</p><label className="report-check"><input type="checkbox" checked={consent} disabled={generating} onChange={event => setConsent(event.target.checked)}/><span>Autorizo el envío de estas notas a OpenAI para generar un borrador que revisaré como terapeuta.</span></label></div>}
    <Failure error={error}/>
    {generating && <p className="report-callout" role="status">Generando el borrador. Puede tardar hasta un minuto y medio; mantén esta ventana abierta.</p>}
    <div className="form-actions"><button className="secondary-button" disabled={generating} onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={!enabled || !preview || !consent || generating || busy} onClick={generate}><FileText size={16} aria-hidden="true"/>{generating ? 'Generando…' : 'Generar borrador con IA'}</button></div>
  </section>;
}
function ReportEditor({ report, onSave, onCancel, onDirtyChange, onBusyChange }) {
  const [title, setTitle] = useState(report.title);
  const [content, setContent] = useState(() => Object.fromEntries(reportFields.map(field => [field.key, { text: report.content[field.key].text, refs: report.content[field.key].sources.join(', ') }])));
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const baseline = JSON.stringify(Object.fromEntries(reportFields.map(field => [field.key, { text: report.content[field.key].text, refs: report.content[field.key].sources.join(', ') }])));
  const dirty = title !== report.title || reviewed || JSON.stringify(content) !== baseline;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { if (!dirty) return; const warn = event => { event.preventDefault(); event.returnValue = ''; }; addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn); }, [dirty]);
  async function submit(event) {
    event.preventDefault();
    const parsed = Object.fromEntries(reportFields.map(field => { const section = content[field.key]; return [field.key, { text: section.text.trim(), sources: section.refs.trim() ? section.refs.split(',').map(value => /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN) : [] }]; }));
    if (!validateReportContent(parsed, report.sources.length)) { setError(new Error('Revisa los textos y las referencias: usa números de sesiones separados por comas, sin repetir.')); return; }
    setBusy(true); onBusyChange(true); setError(null);
    try { await onSave({ title, content: parsed, status: reviewed ? 'reviewed' : 'draft', version: report.version }); }
    catch (err) { setError(err); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <form onSubmit={submit} className="report-editor"><p className="report-callout">Verifica el contenido y sus referencias. Puedes guardar un borrador o marcarlo como revisado.</p><fieldset disabled={busy} className="session-fields"><div className="field-surface"><label htmlFor="report-title">Título</label><div className="field-editor"><input id="report-title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)}/></div></div>{reportFields.map(field => <div className="report-edit-section" key={field.key}><div className="field-surface"><label htmlFor={`report-${field.key}`}>{field.label}</label><div className="field-editor"><ClinicalNotes id={`report-${field.key}`} rows={3} required maxLength={maxReportText} value={content[field.key].text} onChange={event => setContent(v => ({ ...v, [field.key]: { ...v[field.key], text: event.target.value } }))}/></div></div><label className="report-reference-input" htmlFor={`refs-${field.key}`}><span>Sesiones de respaldo</span><input id={`refs-${field.key}`} value={content[field.key].refs} maxLength={1000} placeholder="Ej. 1, 2" onChange={event => setContent(v => ({ ...v, [field.key]: { ...v[field.key], refs: event.target.value } }))}/></label></div>)}<label className="report-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/><span>He revisado y corregido el contenido y sus referencias como terapeuta.</span></label></fieldset><Failure error={error}/><div className="form-actions"><button type="button" disabled={busy} className="secondary-button" onClick={onCancel}>Cancelar</button><button disabled={busy} className="primary-button"><Save size={16} aria-hidden="true"/>{busy ? 'Guardando…' : reviewed ? 'Guardar revisión' : 'Guardar borrador'}</button></div><Sources sources={report.sources}/></form>;
}
export function ReportsPanel({ id, reportId, editing, navigate, onDirtyChange, onBusyChange, service = reportApi }) {
  const base = `/usuarios/${id}/informes`;
  const [report, setReport] = useState(null);
  const [page, setPage] = useState(1);
  const [detailBusy, setBusy] = useState(false);
  const [detailError, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const handleBusy = value => { setWorking(value); onBusyChange(value); };
  const [refresh, setRefresh] = useState(0);
  const detail = Boolean(reportId && reportId !== 'nuevo');
  const { data: list, loading: listBusy, error: listError } = useViewData(service, JSON.stringify(['reports', id, page]), signal => service.list(id, { page, signal }), { refresh, enabled: !detail });
  const busy = detail ? detailBusy : listBusy && !list;
  const error = detailError || listError;
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [reportId, editing]);
  useEffect(() => {
    setError(null); setReport(null);
    if (!detail) { setBusy(false); return; }
    const controller = new AbortController(); let active = true; setBusy(true);
    service.get(id, reportId, controller.signal).then(data => { if (active) setReport(data.report); }).catch(err => { if (active && err.name !== 'AbortError') setError(err); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [id, reportId, refresh, service, detail]);
  async function save(values) {
    const data = await service.save(id, reportId, values); onDirtyChange(false); setReport(data.report); setNotice('Informe guardado correctamente.'); navigate(`${base}/${reportId}`, true); setRefresh(v => v + 1);
  }
  async function download() {
    setError(null); setBusy(true);
    try { const blob = await service.pdf(id, reportId); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `informe-${reportId}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  }
  return <section className="reports-panel" aria-label="Informes clínicos"><div ref={headingRef} tabIndex={-1} className="report-focus-target">
    {reportId && <button className="back-button" disabled={working} onClick={() => navigate(base)}><ArrowLeft size={16} aria-hidden="true"/>Volver a informes</button>}
    {!reportId && <div className="report-list-heading"><div><h3 className="report-view-title">Informes</h3><p>Resume el proceso terapéutico y conserva los documentos revisados.</p></div><button className="primary-button" onClick={() => { setNotice(''); navigate(`${base}/nuevo`); }}><Plus size={16} aria-hidden="true"/>Nuevo informe</button></div>}
  </div>
    {notice && <p className="save-notice" role="status">{notice}</p>}
    {busy && !report && <p className="data-status" role="status">Cargando informes…</p>}
    <Failure error={error} retry={!editing ? () => setRefresh(v => v + 1) : undefined}/>
    {!reportId && list && <>{!list.ai.enabled && <p className="report-callout">Para generar borradores con IA, configura la clave de OpenAI en el servidor.</p>}{list.reports.length ? <div className="report-list">{list.reports.map(row => <a className="report-card" key={row.id} href={`#${base.slice(1)}/${row.id}`} onClick={event => { event.preventDefault(); setNotice(''); navigate(`${base}/${row.id}`); }}><FileText size={21} aria-hidden="true"/><div><strong>{row.title}</strong><p>{periodLabel(row)} · {row.sessionCount} sesiones</p><span className="report-status">{row.status === 'reviewed' ? 'Revisado por terapeuta' : 'Borrador'}</span></div><ChevronRight size={18} aria-hidden="true"/></a>)}</div> : <div className="empty-sessions"><FileText size={28} aria-hidden="true"/><h3>Aún no hay informes</h3><p>Crea un borrador a partir de las sesiones de este usuario.</p></div>}{list.total > list.pageSize && <div className="pagination"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page} de {Math.ceil(list.total / list.pageSize)}</span><button className="secondary-button" disabled={page * list.pageSize >= list.total} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>}</>}
    {reportId === 'nuevo' && list && <ReportCreate id={id} service={service} enabled={list.ai.enabled} onGenerated={created => { setNotice('Borrador generado y guardado. Revísalo antes de utilizarlo.'); navigate(`${base}/${created.id}`, true); }} onCancel={() => navigate(base)} onBusyChange={handleBusy}/>}
    {report && (editing ? <ReportEditor key={`${report.id}-${report.version}`} report={report} onSave={save} onCancel={() => navigate(`${base}/${report.id}`)} onDirtyChange={onDirtyChange} onBusyChange={handleBusy}/> : <article className="report-document"><div className="report-document-heading"><span className="report-status">{report.status === 'reviewed' ? 'Revisado por terapeuta' : 'Borrador · pendiente de revisión'}</span><h3>{report.title}</h3><p>{periodLabel(report)} · {report.sources.length} sesiones</p><div className="report-document-actions"><button className="secondary-button" onClick={() => navigate(`${base}/${report.id}/editar`)}><Pencil size={16} aria-hidden="true"/>Revisar y editar</button><button className="secondary-button" disabled={busy} onClick={download}><Download size={16} aria-hidden="true"/>Descargar PDF</button></div></div>{reportFields.map(field => <section className="report-read-section" key={field.key}><h4>{field.label}</h4><p>{report.content[field.key].text}</p><small>{report.content[field.key].sources.length ? `Sesiones de respaldo: ${report.content[field.key].sources.join(', ')}` : 'Sin referencias registradas'}</small></section>)}<Sources sources={report.sources}/></article>)}
  </section>;
}
