import { useEffect } from 'react';
export function useDirtyForm(dirty, onDirtyChange) {
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { if (!dirty) return; const warn = event => { event.preventDefault(); event.returnValue = ''; }; addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn); }, [dirty]);
}
