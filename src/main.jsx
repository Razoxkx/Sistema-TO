import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, X } from 'lucide-react';
import './styles.css';
import { Brand } from './Brand';
import { Workspace } from './Workspace';
import { request } from './api';
import { LocalAccess } from './LocalAccess';
import { ThemeProvider, ThemeSelect, useTheme } from './Theme';

function GoogleMark() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5h6.6c3.8-3.5 6.1-8.6 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.9-3.6-11.5-8.4H5.7v5.2A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.5 27.7a12 12 0 0 1 0-7.4v-5.2H5.7a20 20 0 0 0 0 17.8l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.6 1 7.7 3l5.8-5.8A19.3 19.3 0 0 0 24 4 20.4 20.4 0 0 0 5.7 15.1l6.8 5.2A12.1 12.1 0 0 1 24 11.9Z"/></svg>;
}
function WelcomeIllustration() {
  return <svg className="welcome-illustration" viewBox="0 0 320 310" fill="none" aria-hidden="true">
    <circle cx="160" cy="152" r="123" fill="var(--illustration-disc)"/>
    <path d="M52 267h216" stroke="var(--illustration-line)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M160 215V90" stroke="var(--illustration-stem)" strokeWidth="5" strokeLinecap="round"/>
    <path d="M159 184c-51 0-78-26-76-67 45-2 78 20 76 67Z" fill="var(--illustration-leaf)"/>
    <path d="M162 153c-1-47 25-78 69-76 0 45-22 75-69 76Z" fill="var(--illustration-leaf-deep)"/>
    <path d="M159 115c-34-7-54-27-49-59 35 3 53 24 49 59Z" fill="var(--illustration-leaf-light)"/>
    <path d="m105 137 54 47m4-31 48-54" stroke="var(--illustration-vein)" strokeWidth="1.5" opacity=".6" strokeLinecap="round"/>
    <path d="M125 211h70l-8 52h-54l-8-52Z" fill="var(--illustration-pot)"/>
    <rect x="120" y="205" width="80" height="10" rx="3" fill="var(--illustration-pot-edge)"/>
  </svg>;
}
function InfoDialog({ kind, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement;
    ref.current.showModal();
    return () => trigger?.focus();
  }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" className="info-dialog" onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <button className="dialog-close" aria-label="Cerrar" onClick={onClose}><X size={22}/></button>
    <h2 id="dialog-title">{kind === 'privacy' ? 'Privacidad' : 'Ayuda para iniciar sesión'}</h2>
    {kind === 'privacy' ? <><p>Al iniciar sesión con Google, Espacio TO recibe tu identificador de cuenta, nombre, correo electrónico y foto de perfil para crear y reconocer tu usuario.</p><p>El registro local guarda tu nombre, correo y un hash de contraseña; el acceso se verifica en este servidor. La sesión se mantiene mediante una cookie de acceso. No solicitamos tu contraseña de Google ni acceso a Gmail, Drive o Calendario.</p><p>Las fichas clínicas contienen los datos personales, antecedentes de salud y observaciones que registra el terapeuta. Cada terapeuta accede a las fichas que crea con su cuenta.</p></> : <><p>Puedes entrar con correo y contraseña o crear una cuenta local. Si ya usabas Google, entra desde localhost con «Continuar con Google» y activa la contraseña en «Mi cuenta» para conservar tus fichas.</p><p>Si no se abre la ventana de acceso, comprueba tu conexión y permite las ventanas emergentes de este sitio.</p><p>Si el acceso aún no está habilitado o tu cuenta no está autorizada, comunícate con quien administra el sistema.</p></>}
    <button className="primary-button" onClick={onClose}>Entendido <Check size={17}/></button>
  </dialog>;
}
function App() {
  const { resolved: theme } = useTheme();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const googleButton = useRef(null);
  const [retry, setRetry] = useState(0);
  const [method, setMethod] = useState('local');
  const googleCompatible = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || (location.protocol === 'https:' && !/^[0-9.]+$/.test(location.hostname) && !location.hostname.includes(':'));
  const showGoogle = !config?.localEnabled || method === 'google';
  useEffect(() => { document.title = user ? 'Inicio · Espacio TO' : 'Iniciar sesión · Espacio TO'; }, [user]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([request('/auth/config'), request('/auth/me')]).then(([settings, session]) => {
      if (active) { setConfig(settings); setUser(session.user); setError(''); }
    }).catch(() => { if (active) setError('No pudimos conectar con el servicio de acceso. Inténtalo nuevamente.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    if (!config?.enabled || !showGoogle || !googleCompatible || user || loading) return;
    let active = true;
    let resizeObserver;
    const initialize = () => {
      if (!active || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: config.clientId, nonce: config.nonce, auto_select: false,
        callback: async ({ credential }) => {
          setBusy(true); setError('');
          try {
            const result = await request('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
            if (active) setUser(result.user);
          } catch (err) { if (active) { setError(err.message); } }
          finally { if (active) setBusy(false); }
        },
      });
      let lastWidth = 0;
      const renderButton = () => {
        if (!active || !googleButton.current) return;
        const width = Math.min(400, Math.floor(googleButton.current.clientWidth));
        if (width === lastWidth || width < 1) return;
        lastWidth = width;
        googleButton.current.replaceChildren();
        window.google.accounts.id.renderButton(googleButton.current, { type: 'standard', theme: theme === 'dark' ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', locale: 'es', width });
      };
      renderButton();
      resizeObserver = new ResizeObserver(renderButton);
      resizeObserver.observe(googleButton.current);
    };
    let script = document.querySelector('#google-identity');
    if (window.google?.accounts) initialize();
    else {
      if (!script) { script = document.createElement('script'); script.id = 'google-identity'; script.src = 'https://accounts.google.com/gsi/client'; script.async = true; document.head.append(script); }
      script.addEventListener('load', initialize);
      script.onerror = () => { if (active) { setError('No pudimos cargar Google. Revisa tu conexión y vuelve a cargar la página.'); script.remove(); } };
    }
    return () => { active = false; resizeObserver?.disconnect(); script?.removeEventListener('load', initialize); };
  }, [config, user, loading, retry, showGoogle, googleCompatible, theme]);
  async function logout() {
    setBusy(true); setError('');
    try { await request('/auth/logout', { method: 'POST' }); window.google?.accounts.id.disableAutoSelect(); setUser(null); setRetry(v => v + 1); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="session-loading" role="status">Cargando tu espacio…</div>;
  if (user) return <Workspace user={user} onLogout={logout} busy={busy} error={error}/>;
  return <div className="app-shell">
    <aside className="welcome-panel" aria-label="Espacio TO, terapia ocupacional">
      <Brand/>
      <div className="welcome-content">
        <h2>Un espacio para<br/>acompañar.</h2>
        <WelcomeIllustration/>
      </div>
      <span className="welcome-footer">© {new Date().getFullYear()} Espacio TO</span>
    </aside>

    <div className="access-panel">
      <header className="access-header"><ThemeSelect/><button onClick={() => setDialog('help')}>¿Necesitas ayuda?</button></header>
      <main className="access-main">
      <section className="access-content" aria-labelledby="access-title">
        <h1 id="access-title">Bienvenido</h1>
        <p className="access-description">
          Tu espacio de terapia ocupacional.
        </p>

          {config?.localEnabled && !showGoogle && <LocalAccess onSuccess={setUser}/>}
          {showGoogle && googleCompatible && <><div className="login-control" aria-busy={busy || loading}>
            {config?.enabled && !loading ?
              <div className="google-button" ref={googleButton} style={{ pointerEvents: busy ? 'none' : undefined, opacity: busy ? .5 : 1 }}/>
              : <button className="google-fallback" disabled={loading} onClick={() => config ? setError('El acceso con Google aún no está configurado. Contacta al administrador del sistema.') : setRetry(v => v + 1)}>
                <GoogleMark/>
                <span>{loading ? 'Preparando acceso…' : 'Continuar con Google'}</span>
              </button>}
            {busy && <p role="status" className="status-text">Validando tu cuenta…</p>}
          </div>
          <p className="account-note">Usamos tu nombre y correo para identificar tu cuenta.</p></>}
          {showGoogle && !googleCompatible && <p className="google-method-note">Para entrar desde la red local, utiliza tu correo y contraseña.</p>}
          {config?.localEnabled && <div className="alternative-login-row">{showGoogle ? <button className="alternative-login" onClick={() => { setError(''); setMethod('local'); }}>Usar correo y contraseña</button> : config.enabled && googleCompatible ? <button className="alternative-login" onClick={() => { setError(''); setMethod('google'); }}>Continuar con Google</button> : <p className="local-account-help">Acceso local desde tu red.</p>}</div>}


        {error && <div className="error-message" role="alert">
          <p>{error}</p>
          {!config && <button onClick={() => setRetry(v => v + 1)}>Volver a intentar</button>}
        </div>}

      </section>
      </main>
      <footer className="site-footer">
        <span className="mobile-copyright">© {new Date().getFullYear()} Espacio TO</span>
        <button onClick={() => setDialog('privacy')}>Privacidad</button>
      </footer>
    </div>
    {dialog && <InfoDialog kind={dialog} onClose={() => setDialog(null)}/>}
  </div>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><App/></ThemeProvider>);
