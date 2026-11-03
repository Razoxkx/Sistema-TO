import { Plus } from 'lucide-react';

export function Brand({ onNavigate }) {
  return <a className="brand" href={onNavigate ? '#inicio' : '/'} aria-label="Espacio TO, inicio" onClick={onNavigate ? event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(); } } : undefined}>
    <span className="brand-mark" aria-hidden="true"><Plus size={23} strokeWidth={2.5}/></span>
    <span className="brand-name">Espacio<span>TO</span><small>Terapia ocupacional</small></span>
  </a>;
}
