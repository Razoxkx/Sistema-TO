import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Users, X, ChevronRight, ClipboardList, Wallet, CalendarDays, KeyRound } from 'lucide-react';
import { Brand } from './Brand';
import { ClinicalUsers } from './ClinicalUsers';
import { Finances } from './Finances';
import { Calendar } from './Calendar';
import { LocalAccount } from './LocalAccount';
import { ThemeSelect } from './Theme';
import { ViewDataProvider } from './ViewData';
import './workspace.css';

function ProfilePhoto({ user }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user.picture]);
  const initials = user.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('') || 'TO';
  return user.picture && !failed
    ? <img className="therapist-photo" src={user.picture} alt={`Foto de ${user.name}`} referrerPolicy="no-referrer" onError={() => setFailed(true)}/>
    : <span className="therapist-photo photo-initials" role="img" aria-label={`Perfil de ${user.name}`}>{initials}</span>;
}

function SidebarContent({ user, collapsed, mobile, onToggle, onClose, onLogout, busy, route, navigate }) {
  return <>
    <div className="sidebar-brand-row"><Brand onNavigate={() => { if (navigate('/inicio')) onClose(); }}/>
      <button className="icon-button sidebar-toggle" onClick={mobile ? onClose : onToggle}
        aria-label={mobile ? 'Cerrar menú' : collapsed ? 'Abrir sidebar' : 'Retraer sidebar'}
        title={mobile ? 'Cerrar menú' : collapsed ? 'Abrir sidebar' : 'Retraer sidebar'}
        aria-controls={mobile ? 'mobile-sidebar' : 'app-sidebar'} aria-expanded={mobile || !collapsed}>
        {mobile ? <X size={19}/> : collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}
      </button>
    </div>
    <nav className="sidebar-nav" aria-label="Navegación principal">
      {[{ path: '/inicio', label: 'Inicio', Icon: Home }, { path: '/usuarios', label: 'Usuarios', Icon: Users }, { path: '/calendario', label: 'Calendario', Icon: CalendarDays, KeyRound }, { path: '/finanzas', label: 'Finanzas', Icon: Wallet }, { path: '/cuenta', label: 'Mi cuenta', Icon: KeyRound }].map(({ path, label, Icon }) => <a key={path} className={`nav-item${route.startsWith(path) ? ' is-active' : ''}`} href={`#${path.slice(1)}`} aria-current={route.startsWith(path) ? 'page' : undefined} aria-label={label} title={collapsed ? label : undefined} onClick={event => { event.preventDefault(); if (navigate(path)) onClose(); }}>
        <Icon size={19} aria-hidden="true"/><span>{label}</span>
      </a>)}
    </nav>
    <div className="sidebar-profile">
      <ProfilePhoto user={user}/>
      <div className="therapist-details"><strong title={user.name}>{user.name}</strong><span>Terapeuta</span></div>
      <button className="icon-button logout-button" onClick={onLogout} disabled={busy} aria-label={busy ? 'Cerrando sesión' : 'Cerrar sesión'} title={busy ? 'Cerrando sesión…' : 'Cerrar sesión'}>
        <LogOut size={19}/>
      </button>
    </div>
  </>;
}

function UnsavedChangesDialog({ onStay, onLeave }) {
  const ref = useRef(null);
  const stayRef = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement;
    ref.current.showModal();
    stayRef.current?.focus();
    return () => trigger?.focus();
  }, []);
  return <dialog ref={ref} className="info-dialog" aria-labelledby="unsaved-title" onCancel={onStay}>
    <h2 id="unsaved-title">Cambios sin guardar</h2>
    <p>Tienes cambios sin guardar. Si sales ahora, se perderán.</p>
    <div className="form-actions"><button ref={stayRef} className="secondary-button" onClick={onStay}>Seguir editando</button><button className="primary-button" onClick={onLeave}>Descartar cambios</button></div>
  </dialog>;
}

export function Workspace({ user, onLogout, busy, error, clinicalService, financeService, reportService, calendarService, planService }) {
  const readRoute = () => '/' + (location.hash.replace(/^#\/?/, '').replace(/\/$/, '') || 'inicio');
  const [route, setRoute] = useState(() => location.hash ? readRoute() : '/inicio');
  const dirtyRef = useRef(false);
  const [pendingLeave, setPendingLeave] = useState(null);
  const onDirtyChange = useCallback(value => { dirtyRef.current = value; }, []);
  function navigate(path, force = false) {
    if (!force && dirtyRef.current) { setPendingLeave({ run: () => navigate(path, true) }); return false; }
    dirtyRef.current = false;
    location.hash = path.slice(1);
    setRoute(path);
    return true;
  }
  useEffect(() => {
    const change = () => {
      const next = location.hash ? readRoute() : '/inicio';
      if (next === route) return;
      if (dirtyRef.current) {
        history.replaceState(null, '', `#${route.slice(1)}`);
        setPendingLeave({ run: () => navigate(next, true) });
      } else setRoute(next);
    };
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, [route]);
  useEffect(() => { document.title = `${route.startsWith('/usuarios') ? 'Usuarios' : route.startsWith('/finanzas') ? 'Finanzas' : route.startsWith('/calendario') ? 'Calendario' : route.startsWith('/cuenta') ? 'Mi cuenta' : 'Inicio'} · Espacio TO`; }, [route]);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('espacio-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    try { localStorage.setItem('espacio-sidebar-collapsed', String(collapsed)); } catch { /* Storage is optional. */ }
  }, [collapsed]);
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const close = () => setMobileOpen(false);
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      menuRef.current?.focus();
    };
  }, [mobileOpen]);
  const closeMenu = () => setMobileOpen(false);
  const shared = { user, onLogout: () => {
    if (dirtyRef.current) setPendingLeave({ run: onLogout });
    else onLogout();
  }, busy, onClose: closeMenu, route, navigate };
  return <ViewDataProvider key={user.id}><div className={`workspace${collapsed ? ' sidebar-collapsed' : ''}`}>
    <a href="#workspace-main" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('workspace-main')?.focus(); }}>Ir al contenido</a>
    <aside id="app-sidebar" className="sidebar desktop-sidebar" aria-label="Menú de Espacio TO">
      <SidebarContent {...shared} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)}/>
    </aside>
    <div className="workspace-body">
      <header className="workspace-header">
        <button ref={menuRef} className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú" aria-expanded={mobileOpen} aria-controls="mobile-sidebar"><Menu size={21}/></button>
        <div className="workspace-breadcrumb"><Home size={16} aria-hidden="true"/><ChevronRight size={13} aria-hidden="true"/><span>{route.startsWith('/usuarios') ? 'Usuarios' : route.startsWith('/finanzas') ? 'Finanzas' : route.startsWith('/calendario') ? 'Calendario' : route.startsWith('/cuenta') ? 'Mi cuenta' : 'Inicio'}</span></div>
        <ThemeSelect/>
      </header>
      <main id="workspace-main" className="workspace-main" tabIndex={-1}>
        {route.startsWith('/usuarios') ? <ClinicalUsers route={route} navigate={navigate} onDirtyChange={onDirtyChange} service={clinicalService} reportService={reportService} planService={planService}/> : route.startsWith('/cuenta') ? <LocalAccount user={user} onDirtyChange={onDirtyChange}/> : route.startsWith('/calendario') ? <Calendar route={route} navigate={navigate} onDirtyChange={onDirtyChange} service={calendarService} users={clinicalService}/> : route.startsWith('/finanzas') ? <Finances route={route} navigate={navigate} service={financeService}/> : <>
          <div className="home-heading"><h1 id="inicio">Hola, {user.name?.split(' ')[0] || 'bienvenido'}</h1><p>Bienvenido a tu espacio de terapia ocupacional.</p></div>
          <section className="home-entry" aria-labelledby="home-users-title"><span className="home-entry-icon"><ClipboardList size={27} strokeWidth={1.6} aria-hidden="true"/></span><div><h2 id="home-users-title">Fichas clínicas</h2><p>Consulta y actualiza la información de tus usuarios.</p><button className="primary-button" onClick={() => navigate('/usuarios')}>Ver usuarios<ChevronRight size={16} aria-hidden="true"/></button></div></section>
        </>}
        {error && <div className="error-message" role="alert"><p>{error}</p></div>}
      </main>
    </div>
    {pendingLeave && <UnsavedChangesDialog onStay={() => setPendingLeave(null)} onLeave={() => { const action = pendingLeave.run; setPendingLeave(null); setMobileOpen(false); dirtyRef.current = false; action(); }}/>}
    {mobileOpen && <dialog ref={dialogRef} id="mobile-sidebar" className="sidebar mobile-sidebar" aria-label="Menú de Espacio TO" onCancel={closeMenu} onClick={event => { if (event.target === dialogRef.current && event.clientX >= dialogRef.current.getBoundingClientRect().right) closeMenu(); }}>
      <SidebarContent {...shared} mobile/>
    </dialog>}
  </div></ViewDataProvider>;
}
