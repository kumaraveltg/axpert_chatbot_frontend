import { useEffect, useRef, useState, useCallback } from 'react';

const CHAT_WS = import.meta.env.VITE_CHAT_URL?.replace('http', 'ws')
             || 'ws://127.0.0.1:8006';

export function useWebSocket(schema) {
  const wsRef          = useRef(null);
  const unmounted      = useRef(false);
  const reconnectTimer = useRef(null);
  const schemaRef      = useRef(schema);          // ← store schema in ref
  const clientId       = useRef(`${schema}_${Math.random().toString(36).slice(2)}`);

  const [events,    setEvents]    = useState([]);
  const [connected, setConnected] = useState(false);

  // ── connect never changes — no dependency ─────────────────
  const connect = useCallback(() => {
    if (!schemaRef.current) return;

    if (wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
       wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url    = `${CHAT_WS}/ws/${clientId.current}`;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      if (unmounted.current) return;
      setConnected(true);
      console.log('[ws] Connected:', clientId.current);
    };

    socket.onmessage = (e) => {
      if (unmounted.current) return;
      try {
        const data = JSON.parse(e.data);
        setEvents(prev => [...prev.slice(-50), data]);
      } catch {}
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onclose = () => {
      if (unmounted.current) return;
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

  }, []);   // ← empty deps — connect never recreated

  useEffect(() => {
    schemaRef.current = schema;   // ← keep ref in sync if schema changes
  }, [schema]);

  useEffect(() => {
    unmounted.current = false;
    // Small delay avoids race on initial mount
    const startTimer = setTimeout(connect, 100);

    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      unmounted.current = true;
      clearTimeout(startTimer); 
      clearTimeout(reconnectTimer.current);
      clearInterval(ping);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);   // ← connect is now stable, effect runs only once

  const clearEvents = useCallback(() => setEvents([]), []);

  return {
    connected,
    events,
    clientId: clientId.current,
    clearEvents
  };
}