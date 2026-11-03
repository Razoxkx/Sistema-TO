import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Users, Wallet } from 'lucide-react';
import { financeApi } from './api';
import { currentMonth, shiftMonth, validMonth } from '../shared/finance-month';
import './finances.css';
import { useViewData } from './ViewData';

const money = amount => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
const monthLabel = (month, short = false) => new Intl.DateTimeFormat('es-CL', { month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
function FinanceLoading({ month }) {
  return <div className="finance-loading">
    <p className="sr-only" role="status">Cargando finanzas…</p>
    <div aria-hidden="true">
      <div className="finance-summary">
        {[['Ingresos del mes', Wallet, monthLabel(month)], ['Sesiones registradas', ClipboardList, 'Durante este período'], ['Usuarios atendidos', Users, 'Con sesiones en el mes']].map(([label, Icon, note], index) => <div key={label} className={`finance-stat${index === 0 ? ' finance-stat-total' : ''}`}><div className="finance-stat-label"><Icon size={18}/>{label}</div><strong>—{index === 0 && <span>CLP</span>}</strong><p>{note}</p></div>)}
      </div>
      <div className="finance-panel"><div className="finance-section-heading"><div><h2>Ingresos por usuario</h2><p className="finance-period-label">{monthLabel(month)}</p></div></div><div className="finance-placeholder-row"><span/><span/><span/></div></div>
      <div className="finance-panel"><div className="finance-section-heading"><div><h2>Historial mensual</h2><p>Selecciona un mes para ver su detalle.</p></div><span>{month.slice(0, 4)}</span></div><div className="finance-month-grid">{Array.from({ length: 12 }, (_, index) => `${month.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`).map(value => <div key={value} className="finance-month"><span>{monthLabel(value, true)}</span><strong>—</strong></div>)}</div></div>
    </div>
  </div>;
}
export function Finances({ route, navigate, service = financeApi }) {
  const [todayMonth, setTodayMonth] = useState(currentMonth);
  const specifiedMonth = route.split('/')[2];
  const month = specifiedMonth || todayMonth;
  const valid = validMonth(month);
  const [paging, setPaging] = useState({ month, page: 1 });
  const page = paging.month === month ? paging.page : 1;
  const [refresh, setRefresh] = useState(0);
  const { data, loading, error } = useViewData(service, JSON.stringify(['finances', month, page]), signal => valid ? service.get(month, { page, signal }) : Promise.resolve(null), { refresh });
  const titleRef = useRef(null);
  const selectedMonthRef = useRef(null);
  const restoreMonthFocus = useRef(false);
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const checkMonth = () => setTodayMonth(currentMonth());
    let lastResume = 0;
    const resume = () => {
      if (document.hidden) return;
      checkMonth();
      // Browsers can emit both visibilitychange and focus for the same return.
      if (Date.now() - lastResume < 500) return;
      lastResume = Date.now();
      setRefresh(value => value + 1);
    };
    const timer = setInterval(checkMonth, 60000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, []);
  useEffect(() => {
    if (!loading && restoreMonthFocus.current && data?.month === month) {
      selectedMonthRef.current?.focus();
      restoreMonthFocus.current = false;
    }
  }, [loading, data, month]);
  const chooseMonth = value => { if (validMonth(value)) navigate(`/finanzas/${value}`); };
  return <div className="finances" aria-busy={loading}>
    <div className="page-heading"><div><h1 ref={titleRef} tabIndex={-1}>Finanzas</h1><p>Los ingresos de tus atenciones, mes a mes.</p></div></div>
    <div className="finance-period-bar">
      <div className="finance-period-control"><CalendarDays size={18} aria-hidden="true"/><div><label htmlFor="finance-month">Período</label><input id="finance-month" type="month" value={valid ? month : ''} min="1900-01" max="2100-12" onInput={event => chooseMonth(event.currentTarget.value)} onChange={event => chooseMonth(event.target.value)}/></div></div>
      <div className="finance-period-actions"><button className="icon-button" aria-label="Mes anterior" disabled={!valid || month === '1900-01'} onClick={() => chooseMonth(shiftMonth(month, -1))}><ChevronLeft size={20}/></button><button className="icon-button" aria-label="Mes siguiente" disabled={!valid || month === '2100-12'} onClick={() => chooseMonth(shiftMonth(month, 1))}><ChevronRight size={20}/></button><button className="secondary-button" onClick={() => { navigate('/finanzas'); setTodayMonth(currentMonth()); setRefresh(v => v + 1); }}>Mes actual</button></div>
    </div>
    {!valid ? <div className="error-message" role="alert"><p>El período no es válido. Selecciona un mes para continuar.</p></div> : <>
      <p className="finance-basis">Se suman los valores de las sesiones realizadas según su fecha de atención, en pesos chilenos.</p>
      {loading && !data && <FinanceLoading month={month}/>}
      {error && <div className="error-message" role="alert"><p>{error.message}</p>{error.status === 401 ? <button onClick={() => location.reload()}>Volver a iniciar sesión</button> : <button onClick={() => setRefresh(v => v + 1)}>Volver a intentar</button>}</div>}
      {data?.month === month && <>
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
