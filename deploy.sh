#!/usr/bin/env bash
# Script de deploy para produção
# Uso: bash deploy.sh

set -e

echo "🚀 Iniciando deploy do Achadinhos Clubedodesconto..."

# 1. Instalar dependências
echo "📦 Instalando dependências..."
npm install --production=false

# 2. Build do frontend
echo "🔨 Buildando frontend..."
npm run build

# 3. Copiar build para o servidor
echo "📁 Copiando build para o servidor..."
rm -rf server/public
cp -r dist server/public

# 4. Verificar .env
if [ ! -f server/.env ]; then
  echo "❌ Arquivo server/.env não encontrado!"
  echo "   Crie o arquivo baseado no server/.env.example"
  exit 1
fi

echo ""
echo "✅ Build concluído!"
echo ""
echo "Para iniciar o servidor em produção:"
echo "   npm run prod"
echo ""
echo "Ou usando PM2 (recomendado):"
echo "   npm install -g pm2"
echo "   NODE_ENV=production pm2 start server/index.js --name loja"
echo ""
