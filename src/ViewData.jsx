import { createContext, useContext, useEffect, useRef, useState } from 'react';

const ViewDataContext = createContext(null);
function createCache() {
  const services = new Map();
  return {
    get(service, key) { return services.get(service)?.get(key); },
    set(service, key, value) {
      if (!services.has(service)) services.set(service, new Map());
      const entries = services.get(service);
      entries.delete(key);
      entries.set(key, value);
      // Bound the data retained in memory during this authenticated visit.
      if (entries.size > 30) entries.delete(entries.keys().next().value);
    },
    clear() { services.clear(); },
  };
}

// This provider is scoped to a therapist's workspace and discarded on logout.
// Clinical information is never written to browser storage.
export function ViewDataProvider({ children }) {
  const [cache] = useState(createCache);
  return <ViewDataContext.Provider value={cache}>{children}</ViewDataContext.Provider>;
}

export function useViewData(service, key, load, { refresh = 0, delay = 0, enabled = true } = {}) {
  const shared = useContext(ViewDataContext);
  const fallback = useRef(null);
  if (!fallback.current) fallback.current = createCache();
  const cache = shared || fallback.current;
  const [state, setState] = useState(() => ({ service, key, data: cache.get(service, key), loading: true, error: null }));
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    setState({ service, key, data: cache.get(service, key), loading: true, error: null });
    const run = async () => {
      try {
        const data = await load(controller.signal);
        if (!active) return;
        cache.set(service, key, data);
        setState({ service, key, data, loading: false, error: null });
      } catch (error) {
        if (!active || error.name === 'AbortError') return;
        if (error.status === 401) cache.clear();
        setState({ service, key, data: error.status === 401 ? undefined : cache.get(service, key), loading: false, error });
      }
    };
    const timer = delay ? setTimeout(run, delay) : null;
    if (!delay) run();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
    // The query key and service identify the request. An inline loader must not
    // trigger another fetch after every render; explicit refresh handles writes.
  }, [cache, service, key, refresh, delay, enabled]);
  if (!enabled) return { data: undefined, loading: false, error: null };
  if (state.service !== service || state.key !== key) return { data: cache.get(service, key), loading: true, error: null };
  return state;
}
