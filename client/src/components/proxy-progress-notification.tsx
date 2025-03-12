import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Timer } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
type ProxyCheckProgress = {
  id: string;
  total: number;
  checked: number;
  working: number;
  failed: number;
  speed?: number;
};
type WebSocketMessage = {
  type: string;
  data: ProxyCheckProgress;
};
let activeCheckId: string | null = null;
export function ProxyProgressNotification() {
  const [progress, setProgress] = useState<ProxyCheckProgress | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'checking' | 'completed' | 'error'>('checking');
  const [maxResponseTime, setMaxResponseTime] = useState<number>(500);
  useEffect(() => {
    const savedValue = localStorage.getItem('proxyMaxResponseTime');
    if (savedValue) {
      setMaxResponseTime(parseInt(savedValue));
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('proxyMaxResponseTime', maxResponseTime.toString());
  }, [maxResponseTime]);
  const handleMaxResponseTimeChange = (value: number[]) => {
    const newValue = value[0];
    setMaxResponseTime(newValue);
    const event = new CustomEvent('proxyMaxResponseTimeChanged', {
      detail: { maxResponseTime: newValue }
    });
    window.dispatchEvent(event);
  };
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        if (message.type === 'proxyCheckStarted' || message.type === 'proxyCheckProgress') {
          setProgress(message.data);
          setVisible(true);
          setStatus('checking');
        } else if (message.type === 'proxyCheckCompleted') {
          setProgress(message.data);
          setStatus('completed');
          setTimeout(() => {
            setVisible(false);
          }, 5000);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setStatus('error');
      }
    };
    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };
    return () => {
      ws.close();
    };
  }, []);
  if (!visible || !progress) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              {status === 'checking' && <Timer className="h-5 w-5 text-blue-500 mr-2" />}
              {status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500 mr-2" />}
              {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500 mr-2" />}
              <span className="font-medium">
                {status === 'checking' && 'Проверка прокси...'}
                {status === 'completed' && 'Проверка завершена'}
                {status === 'error' && 'Ошибка проверки'}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {progress.checked}/{progress.total}
            </span>
          </div>
          <Progress value={(progress.checked / progress.total) * 100} className="h-2 mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Рабочих: {progress.working}</span>
            <span>Нерабочих: {progress.failed}</span>
            {progress.speed && <span>{progress.speed.toFixed(1)} прокси/сек</span>}
          </div>
          <div className="mt-4">
            <Label htmlFor="max-response-time" className="mb-1 block">
              Макс. время отклика: {maxResponseTime} мс
            </Label>
            <Slider
              id="max-response-time"
              min={100}
              max={1000}
              step={50}
              value={[maxResponseTime]}
              onValueChange={handleMaxResponseTimeChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}