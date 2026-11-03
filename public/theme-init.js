// Runs before the page is painted, including when browser storage is unavailable.
(() => {
  const appWindow = matchMedia('(display-mode: standalone)');
  const setDisplayMode = () => {
    document.documentElement.dataset.displayMode = navigator.standalone === true || appWindow.matches ? 'standalone' : 'browser';
  };
  setDisplayMode();
  appWindow.addEventListener('change', setDisplayMode);
  let preference = 'system';
  try {
    const saved = localStorage.getItem('espacio-theme');
    if (['light', 'dark', 'system'].includes(saved)) preference = saved;
  } catch { /* The system preference remains available in private browsing. */ }
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17251d' : '#eaf2ec');
})();
