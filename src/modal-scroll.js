let depth = 0;
let previousOverflow = '';
export function lockBodyScroll() {
  if (depth === 0) previousOverflow = document.body.style.overflow;
  depth += 1;
  document.body.style.overflow = 'hidden';
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    depth = Math.max(0, depth - 1);
    if (depth === 0) document.body.style.overflow = previousOverflow;
  };
}
