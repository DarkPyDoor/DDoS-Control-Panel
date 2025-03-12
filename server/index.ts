import express, { type Request, Response, NextFunction } from 'express';
import { WebSocketServer } from 'ws';
import { registerRoutes } from './routes';
import { setupAuth } from './auth';
import { storage } from './storage'; 
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }
      console.log(logLine);
    }
  });
  next();
});
(async () => {
  const server = app.listen(0, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 5000;
    console.log(`Сервер запущен на порту ${port}`);
    const interfaces = os.networkInterfaces();
    console.log('Доступные IP адреса:');
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`  http:
        }
      }
    }
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    console.log('[DEBUG] New WebSocket connection established');
    storage.getProxies().then((proxies) => {
      ws.send(JSON.stringify({ type: 'proxies', data: proxies }));
    });
    ws.on('message', (message) => {
      console.log('WebSocket message received:', message.toString());
    });
    ws.on('close', (code, reason) => {
      console.log(`[DEBUG] WebSocket соединение закрыто. Код: ${code}, Причина: ${reason}`);
    });
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  setupAuth(app);
  await registerRoutes(app);
  app.get('/api/proxies', async (_req, res) => {
    try {
      const proxies = await storage.getProxies();
      res.json(proxies);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching proxies' });
    }
  });
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ message });
    throw err;
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
})();