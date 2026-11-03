import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockBodyScroll } from './modal-scroll';
export function FormModal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement; const dialog = ref.current; const unlock = lockBodyScroll();
    dialog.showModal();
    return () => { dialog.close(); unlock(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} className="clinical-modal form-modal" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header className="clinical-modal-header"><div className="modal-title-row"><h2>{title}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label={`Cerrar ${title.toLowerCase()}`}><X size={21}/></button></div></header><div className="clinical-modal-body">{children}</div></dialog>, document.body);
}
