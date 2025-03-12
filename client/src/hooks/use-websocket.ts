import { useState, useEffect } from 'react';
export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log('WebSocket соединение установлено');
    };
    ws.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
    };
    ws.onclose = (event) => {
      console.log(`WebSocket соединение закрыто: ${event.code}, ${event.reason}`);
    };
    setSocket(ws);
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);
  return socket;
}