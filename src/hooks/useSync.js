import { useState, useEffect, useCallback } from 'react';
import { syncApi } from '../api/api';

export function useSync(schema = 'hcaspay') {
  const [modules,  setModules]  = useState([]);
  const [syncing,  setSyncing]  = useState(false);
  const [syncLog,  setSyncLog]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await syncApi.listModules(schema);
      setModules(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [schema]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const toggle = useCallback(async (root, sub, current) => {
    const enable = current !== 'Y';
    try {
      await syncApi.toggleModule(schema, root, sub, enable);
      setModules(prev => prev.map(m =>
        m.root_module === root && m.sub_module === sub
          ? { ...m, is_enabled: enable ? 'Y' : 'N' }
          : m
      ));
    } catch (e) {
      setError(e.message);
    }
  }, [schema]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setSyncLog([]);
    try {
      const data = await syncApi.run(schema);
      setSyncLog(data.details || []);
      await fetchModules();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [schema, fetchModules]);

  const registerModules = useCallback(async () => {
    try {
      await syncApi.registerModules(schema);
      await fetchModules();
    } catch (e) {
      setError(e.message);
    }
  }, [schema, fetchModules]);

  return {
    modules, syncing, syncLog, loading, error,
    toggle, runSync, registerModules, fetchModules
  };
}
