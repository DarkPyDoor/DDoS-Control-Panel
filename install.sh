#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   Установка Панели управления DDoS  ${NC}"
echo -e "${GREEN}=====================================${NC}"

# Проверка наличия необходимых инструментов
echo -e "${YELLOW}Проверка необходимых инструментов...${NC}"

# Проверка и установка Node.js (версия 18.x)
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js не установлен. Установка версии 18.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js уже установлен: $NODE_VERSION${NC}"
fi

# Проверка и установка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm не установлен. Установка...${NC}"
    sudo apt-get install -y npm
else
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}npm уже установлен: $NPM_VERSION${NC}"
fi

# Проверка и установка git
if ! command -v git &> /dev/null; then
    echo -e "${RED}git не установлен. Установка...${NC}"
    sudo apt-get install -y git
else
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}git уже установлен: $GIT_VERSION${NC}"
fi

# Проверка и установка Python 3.10
if ! command -v python3.10 &> /dev/null; then
    echo -e "${YELLOW}Python 3.10 не установлен. Установка...${NC}"
    sudo apt update
    sudo apt install -y software-properties-common
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt update
    sudo apt install -y python3.10 python3.10-distutils python3.10-dev python3.10-venv
else
    PYTHON_VERSION=$(python3.10 --version)
    echo -e "${GREEN}Python 3.10 уже установлен: $PYTHON_VERSION${NC}"
fi

# Проверка и установка pip для Python 3.10
if ! command -v pip3.10 &> /dev/null; then
    echo -e "${YELLOW}pip3.10 не установлен. Установка...${NC}"
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3.10
else
    PIP_VERSION=$(pip3.10 --version)
    echo -e "${GREEN}pip3.10 уже установлен: $PIP_VERSION${NC}"
fi

# Очистка старых данных перед установкой
echo -e "${YELLOW}Очистка старых сборок и кэша...${NC}"
rm -rf /root/DDoS-Control-Panel/dist /root/DDoS-Control-Panel/node_modules /root/DDoS-Control-Panel/package-lock.json
echo -e "${GREEN}Очистка завершена${NC}"

# Установка зависимостей Node.js
echo -e "${YELLOW}Установка зависимостей Node.js...${NC}"
npm install || { echo -e "${RED}Ошибка установки зависимостей! Проверьте интернет-соединение или npm логи.${NC}"; exit 1; }
echo -e "${GREEN}Зависимости успешно установлены${NC}"

# Сборка проекта
echo -e "${YELLOW}Сборка клиентской и серверной частей...${NC}"
npm run build || { echo -e "${RED}Ошибка сборки проекта! Проверьте логи выше или файлы конфигурации (vite.config.ts, server/index.ts).${NC}"; exit 1; }
echo -e "${GREEN}Сборка успешно завершена${NC}"

# Проверка структуры сборки
echo -e "${YELLOW}Проверка наличия index.html в dist/public...${NC}"
if [ ! -f "/root/DDoS-Control-Panel/dist/public/index.html" ]; then
    echo -e "${RED}Ошибка: index.html не найден в /root/DDoS-Control-Panel/dist/public. Проверьте vite.config.ts.${NC}"
    exit 1
else
    echo -e "${GREEN}index.html найден${NC}"
fi

# Установка MHDDoS
echo -e "${YELLOW}Установка или обновление MHDDoS...${NC}"
if [ ! -d "/root/MHDDoS" ]; then
    cd /root
    git clone https://github.com/MatrixTM/MHDDoS.git || { echo -e "${RED}Ошибка клонирования MHDDoS!${NC}"; exit 1; }
    cd MHDDoS
    pip3.10 install -r requirements.txt || { echo -e "${RED}Ошибка установки зависимостей MHDDoS!${NC}"; exit 1; }
    echo -e "${GREEN}MHDDoS успешно установлен${NC}"
else
    echo -e "${GREEN}MHDDoS уже установлен. Обновление...${NC}"
    cd /root/MHDDoS
    git pull || { echo -e "${RED}Ошибка обновления MHDDoS!${NC}"; exit 1; }
    pip3.10 install -r requirements.txt || { echo -e "${RED}Ошибка обновления зависимостей MHDDoS!${NC}"; exit 1; }
    echo -e "${GREEN}MHDDoS успешно обновлен${NC}"
fi

# Установка PyRoxy
echo -e "${YELLOW}Установка или обновление PyRoxy...${NC}"
if [ ! -d "/root/PyRoxy" ]; then
    cd /root
    git clone https://github.com/MatrixTM/PyRoxy.git || { echo -e "${RED}Ошибка клонирования PyRoxy!${NC}"; exit 1; }
    cd PyRoxy
    pip3.10 install -r requirements.txt || { echo -e "${RED}Ошибка установки зависимостей PyRoxy!${NC}"; exit 1; }
    cp -r /root/PyRoxy/PyRoxy /root/MHDDoS/ || { echo -e "${RED}Ошибка копирования PyRoxy в MHDDoS!${NC}"; exit 1; }
    echo -e "${GREEN}PyRoxy успешно установлен${NC}"
else
    echo -e "${GREEN}PyRoxy уже установлен. Обновление...${NC}"
    cd /root/PyRoxy
    git pull || { echo -e "${RED}Ошибка обновления PyRoxy!${NC}"; exit 1; }
    pip3.10 install -r requirements.txt || { echo -e "${RED}Ошибка обновления зависимостей PyRoxy!${NC}"; exit 1; }
    cp -r /root/PyRoxy/PyRoxy /root/MHDDoS/ || { echo -e "${RED}Ошибка копирования PyRoxy в MHDDoS!${NC}"; exit 1; }
    echo -e "${GREEN}PyRoxy успешно обновлен${NC}"
fi

# Финальное сообщение и запуск сервера
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN} Установка завершена успешно!${NC}"
echo -e "${GREEN} Запуск сервера...${NC}"
echo -e "${GREEN}=====================================${NC}"
cd /root/DDoS-Control-Panel
npm start || { echo -e "${RED}Ошибка запуска сервера! Проверьте логи выше.${NC}"; exit 1; }