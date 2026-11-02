import { Plus } from 'lucide-react';

export function Brand() {
  return <a className="brand" href="/" aria-label="Espacio TO, inicio">
    <span className="brand-mark" aria-hidden="true"><Plus size={23} strokeWidth={2.5}/></span>
    <span className="brand-name">Espacio<span>TO</span><small>Terapia ocupacional</small></span>
  </a>;
}
