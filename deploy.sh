#!/bin/bash

# --- CONFIGURATION ---
APP_NAME="ny-lottery"
SERVER_PORT=3001
REPO_URL="https://github.com/LivelyPuer/Lotery.git"
# ---------------------

echo "🎄 Начинаем автоматическое развертывание Новогодней Лотереи..."

# 1. Функция установки системных пакетов
install_packages() {
    echo "⚙️ Проверка и установка системных зависимостей..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y curl git build-essential
        # Установка Node.js (если нет)
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    elif [ -f /etc/redhat-release ]; then
        sudo dnf install -y curl git gcc-c++ make
        if ! command -v node &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y nodejs
        fi
    else
        echo "⚠️ Операционная система не распознана для автоустановки пакетов. Убедитесь, что git, node и npm установлены."
    fi
}

install_packages

# 2. Обновление кода / Git
if [ -d ".git" ]; then
    echo "🔄 Обновление кода из репозитория..."
    git pull origin main || git pull origin master
else
    echo "📥 Репозиторий не найден. Клонирование..."
    git clone $REPO_URL .
fi

# 3. Установка зависимостей сервера
echo "📦 Установка зависимостей сервера..."
cd server
npm install --omit=dev
cd ..

# 4. Установка зависимостей и сборка клиента
echo "🏗️ Сборка фронтенда..."
cd client
npm install
npm run build
cd ..

# 5. Настройка PM2
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ Установка PM2 глобально..."
    sudo npm install -g pm2
fi

# 6. Запуск решения
echo "🚀 Перезапуск приложения через PM2..."
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

cd server
PORT=$SERVER_PORT pm2 start index.js --name "$APP_NAME"
cd ..

echo "✅ Развертывание завершено успешно!"
echo "📍 Приложение доступно по адресу: http://localhost:$SERVER_PORT"
echo "📜 Логи: 'pm2 logs $APP_NAME'"
