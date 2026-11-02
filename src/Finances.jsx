import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Users, Wallet } from 'lucide-react';
import { financeApi } from './api';
import { currentMonth, shiftMonth, validMonth } from '../shared/finance-month';
import './finances.css';

const money = amount => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
const monthLabel = (month, short = false) => new Intl.DateTimeFormat('es-CL', { month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
export function Finances({ route, navigate, service = financeApi }) {
  const [todayMonth, setTodayMonth] = useState(currentMonth);
  const specifiedMonth = route.split('/')[2];
  const month = specifiedMonth || todayMonth;
  const valid = validMonth(month);
  const [paging, setPaging] = useState({ month, page: 1 });
  const page = paging.month === month ? paging.page : 1;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const titleRef = useRef(null);
  const selectedMonthRef = useRef(null);
  const restoreMonthFocus = useRef(false);
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const checkMonth = () => setTodayMonth(currentMonth());
    const resume = () => { if (!document.hidden) { checkMonth(); setRefresh(value => value + 1); } };
    const timer = setInterval(checkMonth, 60000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, []);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(null); setData(null);
    service.get(month, { page, signal: controller.signal }).then(result => { if (active) setData(result); }).catch(err => { if (active && err.name !== 'AbortError') setError(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [month, page, valid, refresh, service]);
  useEffect(() => {
    if (!loading && restoreMonthFocus.current && data?.month === month) {
      selectedMonthRef.current?.focus();
      restoreMonthFocus.current = false;
    }
  }, [loading, data, month]);
  const chooseMonth = value => { if (validMonth(value)) navigate(`/finanzas/${value}`); };
  return <div className="finances">
    <div className="page-heading"><div><h1 ref={titleRef} tabIndex={-1}>Finanzas</h1><p>Los ingresos de tus atenciones, mes a mes.</p></div></div>
    <div className="finance-period-bar">
      <div className="finance-period-control"><CalendarDays size={18} aria-hidden="true"/><div><label htmlFor="finance-month">Período</label><input id="finance-month" type="month" value={valid ? month : ''} min="1900-01" max="2100-12" onInput={event => chooseMonth(event.currentTarget.value)} onChange={event => chooseMonth(event.target.value)}/></div></div>
      <div className="finance-period-actions"><button className="icon-button" aria-label="Mes anterior" disabled={!valid || month === '1900-01'} onClick={() => chooseMonth(shiftMonth(month, -1))}><ChevronLeft size={20}/></button><button className="icon-button" aria-label="Mes siguiente" disabled={!valid || month === '2100-12'} onClick={() => chooseMonth(shiftMonth(month, 1))}><ChevronRight size={20}/></button><button className="secondary-button" onClick={() => { navigate('/finanzas'); setTodayMonth(currentMonth()); setRefresh(v => v + 1); }}>Mes actual</button></div>
    </div>
    {!valid ? <div className="error-message" role="alert"><p>El período no es válido. Selecciona un mes para continuar.</p></div> : <>
      <p className="finance-basis">Se suman los valores de las sesiones realizadas según su fecha de atención, en pesos chilenos.</p>
      {loading && <p className="data-status" role="status">Cargando finanzas…</p>}
      {error && <div className="error-message" role="alert"><p>{error.message}</p>{error.status === 401 ? <button onClick={() => location.reload()}>Volver a iniciar sesión</button> : <button onClick={() => setRefresh(v => v + 1)}>Volver a intentar</button>}</div>}
      {!loading && !error && data?.month === month && <>
        <section className="finance-summary" aria-label={`Resumen de ${monthLabel(month)}`}>
          <div className="finance-stat finance-stat-total"><div className="finance-stat-label"><Wallet size={18} aria-hidden="true"/>Ingresos del mes</div><strong>{money(data.summary.totalAmount)}<span>CLP</span></strong><p>{monthLabel(month)}</p></div>
          <div className="finance-stat"><div className="finance-stat-label"><ClipboardList size={18} aria-hidden="true"/>Sesiones registradas</div><strong>{data.summary.sessionCount}</strong><p>Durante este período</p></div>
          <div className="finance-stat"><div className="finance-stat-label"><Users size={18} aria-hidden="true"/>Usuarios atendidos</div><strong>{data.summary.userCount}</strong><p>Con sesiones en el mes</p></div>
        </section>
        {data.summary.unpricedSessions > 0 && <p className="finance-unpriced" role="status"><CircleAlert size={17} aria-hidden="true"/><span>{data.summary.unpricedSessions} {data.summary.unpricedSessions === 1 ? 'sesión sin valor registrado. Complétala' : 'sesiones sin valor registrado. Complétalas'} desde la ficha clínica para incluir su importe en el total.</span></p>}
        <section className="finance-panel" aria-labelledby="finance-users-title">
          <div className="finance-section-heading"><div><h2 id="finance-users-title">Ingresos por usuario</h2><p className="finance-period-label">{monthLabel(month)}</p></div><span>{data.totalUsers} {data.totalUsers === 1 ? 'usuario' : 'usuarios'}</span></div>
          {data.users.length ? <>
            <table className="finance-table"><caption className="sr-only">Ingresos por usuario en {monthLabel(month)}</caption><thead><tr><th scope="col">Usuario</th><th scope="col">Sesiones</th><th scope="col">Ingresos del mes</th></tr></thead><tbody>{data.users.map(user => <tr key={user.id}>
              <td className="finance-user"><a href={`#usuarios/${user.id}`} onClick={event => { event.preventDefault(); navigate(`/usuarios/${user.id}`); }}><span>{user.name}</span><ArrowUpRight size={16} aria-hidden="true"/></a>{user.unpricedSessions > 0 && <small>{user.unpricedSessions} {user.unpricedSessions === 1 ? 'sesión sin valor' : 'sesiones sin valor'}</small>}</td>
              <td className="finance-sessions">{user.sessionCount}<span className="finance-mobile-label" aria-hidden="true"> sesiones</span></td><td className="finance-user-total">{money(user.totalAmount)}</td>
            </tr>)}</tbody></table>
            {data.totalUsers > data.pageSize && <div className="pagination finance-pagination"><button className="secondary-button" disabled={page === 1} onClick={() => setPaging({ month, page: page - 1 })}>Anterior</button><span>Página {page} de {Math.ceil(data.totalUsers / data.pageSize)}</span><button className="secondary-button" disabled={page * data.pageSize >= data.totalUsers} onClick={() => setPaging({ month, page: page + 1 })}>Siguiente</button></div>}
          </> : <div className="finance-empty"><CalendarDays size={28} aria-hidden="true"/><h3>No hay sesiones en este mes</h3><p>Selecciona otro período o registra una sesión en la ficha de un usuario.</p><button className="secondary-button" onClick={() => navigate('/usuarios')}>Ver usuarios</button></div>}
        </section>
        <section className="finance-panel finance-year" aria-labelledby="finance-year-title"><div className="finance-section-heading"><div><h2 id="finance-year-title">Historial mensual</h2><p>Selecciona un mes para ver su detalle.</p></div><span>{month.slice(0, 4)}</span></div><div className="finance-month-grid">{data.yearMonths.map(item => <button key={item.month} className="finance-month" ref={item.month === month ? selectedMonthRef : undefined} aria-pressed={item.month === month} aria-label={`${monthLabel(item.month)}: ${money(item.totalAmount)}${item.unpricedSessions ? `, ${item.unpricedSessions} sesiones sin valor` : ''}`} onClick={() => { restoreMonthFocus.current = item.month !== month; chooseMonth(item.month); }}><span>{monthLabel(item.month, true)}</span><strong>{money(item.totalAmount)}</strong>{item.unpricedSessions > 0 && <small>Sin valores completos</small>}</button>)}</div></section>
      </>}
    </>}
  </div>;
}
