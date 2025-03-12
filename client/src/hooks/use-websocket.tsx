import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';
export function useWebSocket() {
  const { toast } = useToast();
  const ws = useRef<WebSocket | null>(null);
  useEffect(() => {
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const wsUrl = `ws:
    console.log('[DEBUG] Подключение к WebSocket:', wsUrl);
    let reconnectTimeout: NodeJS.Timeout;
    function connect() {
      try {
        ws.current = new WebSocket(wsUrl);
        ws.current.onopen = () => {
          console.log('WebSocket Connected');
        };
        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case 'attackStarted':
                toast({
                  title: "Атака запущена",
                  description: `Цель: ${data.data.target}`,
                });
                break;
              case 'attackFinished':
                toast({
                  title: "Атака завершена",
                  description: `Цель: ${data.data.target}`,
                });
                break;
              case 'error':
                toast({
                  title: "Ошибка",
                  description: data.message,
                  variant: "destructive",
                });
                break;
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        ws.current.onclose = () => {
          console.log('WebSocket disconnected, attempting to reconnect...');
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (error) {
        console.error('Failed to establish WebSocket connection:', error);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }
    connect();
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [toast]);
  return ws.current;
}