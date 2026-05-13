import { useState, useCallback } from 'react';
import { chatApi } from '../api/api';

export function useChat() {
  const [messages,  setMessages]  = useState([{
    id: 1, role: 'bot',
    text: 'Hello! I am your Axpert ERP assistant. Ask me anything about forms, workflows, or implementation steps.',
    meta: null, time: now()
  }]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState({});

  const send = useCallback(async (question, industry, module, mode) => {
    if (!question.trim() || loading) return;

    const userMsg = { id: Date.now(), role: 'user', text: question, meta: null, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setHistory(prev => [{ question, time: now() }, ...prev].slice(0, 20));
    setLoading(true);

    try {
      const data = await chatApi.send(question, industry, module || null, mode,messages);
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: data.answer,
        meta: {
          sources:      data.sources,
          min_distance: data.min_distance,
          chunks_used:  data.chunks_used,
          practice:     data.practice
        },
        time: now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot',
        text: '⚠️ ' + e.message + '. Make sure chat service is running on port 8006.',
        meta: null, time: now()
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const clear = useCallback(() => {
    setMessages([{
      id: Date.now(), role: 'bot',
      text: 'Chat cleared. Ask me anything about Axpert ERP.',
      meta: null, time: now()
    }]);
  }, []);

  const rateFeedback = useCallback((msgId, rating) => {
    setFeedback(prev => ({ ...prev, [msgId]: rating }));
  }, []);

  return { messages, loading, history, feedback, send, clear, rateFeedback };
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
