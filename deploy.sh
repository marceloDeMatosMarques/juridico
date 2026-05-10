#!/usr/bin/env bash
set -e

echo "==> Building frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "==> Building backend..."
cd backend
npm ci
npx prisma generate
npm run build

echo "==> Restarting API..."
pm2 restart juriscontrol-api || pm2 start ecosystem.config.js
pm2 save
cd ..

echo "==> Done."
