let depth = 0;
let previousOverflow = '';
let restorePage = () => {};
export function lockBodyScroll() {
  if (depth === 0) {
    previousOverflow = document.body.style.overflow;
    const root = document.documentElement;
    const previousModal = root.getAttribute('data-modal-open');
    root.dataset.modalOpen = 'true';
    let restorePosition = () => {};
    if (root.dataset.displayMode === 'standalone') {
      const body = document.body;
      const x = window.scrollX, y = window.scrollY;
      const saved = Object.fromEntries(['position', 'top', 'left', 'right', 'width'].map(key => [key, body.style[key]]));
      Object.assign(body.style, { position: 'fixed', top: `${-y}px`, left: '0', right: '0', width: '100%' });
      restorePosition = () => { Object.assign(body.style, saved); window.scrollTo(x, y); };
    }
    restorePage = () => {
      if (previousModal === null) root.removeAttribute('data-modal-open');
      else root.setAttribute('data-modal-open', previousModal);
      restorePosition();
    };
  }
  depth += 1;
  document.body.style.overflow = 'hidden';
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    depth = Math.max(0, depth - 1);
    if (depth === 0) { document.body.style.overflow = previousOverflow; restorePage(); restorePage = () => {}; }
  };
}
