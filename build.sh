#!/usr/bin/env bash
set -e

echo "📦 Instalando dependências..."
npm ci || npm install

echo "🔨 Buildando frontend..."
npm run build

echo "📁 Copiando build para o servidor..."
rm -rf server/public
cp -r dist server/public

echo "✅ Build concluído!"
