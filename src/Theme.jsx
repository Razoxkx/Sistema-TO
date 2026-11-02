import { createContext, useContext, useEffect, useState } from 'react';
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import './theme.css';

const ThemeContext = createContext(null);
const validPreference = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
const key = 'espacio-theme';

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => validPreference(document.documentElement.dataset.themePreference));
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = event => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener('change', update);
    const sync = event => {
      if (event.key === key || event.key === null) setPreference(validPreference(event.newValue));
    };
    addEventListener('storage', sync);
    return () => { media.removeEventListener('change', update); removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#17251d' : '#eaf2ec');
  }, [preference, resolved]);
  function change(value) {
    const next = validPreference(value);
    setPreference(next);
    try { localStorage.setItem(key, next); } catch { /* Choosing a theme still works without storage. */ }
  }
  return <ThemeContext.Provider value={{ preference, resolved, change }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeSelect() {
  const theme = useTheme();
  if (!theme) return null;
  const Icon = theme.preference === 'system' ? Monitor : theme.preference === 'dark' ? Moon : Sun;
  const label = { light: 'Claro', dark: 'Oscuro', system: 'Sistema' }[theme.preference];
  return <div className="theme-select" title={`Apariencia: ${label}`}>
    <span className="theme-select-display" aria-hidden="true"><Icon size={18}/><span>{label}</span><ChevronDown size={14} className="theme-select-chevron"/></span>
    <select aria-label="Apariencia" value={theme.preference} onChange={event => theme.change(event.target.value)}>
      <option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Sistema</option>
    </select>
  </div>;
}
