#!/bin/bash
# deploy.sh — JurisControl deploy helper
# Uso: ./deploy.sh  (na raiz ~/htdocs/lex.m3br.com.br/)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$SCRIPT_DIR/frontend"
BACKEND="$SCRIPT_DIR/backend"
API_SERVICE="juriscontrol-api"
WEB_SERVICE="juriscontrol-web"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "${RED}✖ $1${NC}"; }

build_frontend() {
  echo ""
  echo "=== Build Frontend ==="
  cd "$FRONTEND" || { err "Pasta frontend não encontrada"; return 1; }
  npm run build && ok "Frontend compilado" || { err "Falha no build do frontend"; return 1; }
  cd "$SCRIPT_DIR"
  pm2 restart "$WEB_SERVICE" --update-env && ok "PM2 $WEB_SERVICE reiniciado" || warn "Falha ao reiniciar $WEB_SERVICE"
}

build_backend() {
  echo ""
  echo "=== Build Backend ==="
  cd "$BACKEND" || { err "Pasta backend não encontrada"; return 1; }
  npm run build && ok "Backend compilado" || { err "Falha no build do backend"; return 1; }
  cd "$SCRIPT_DIR"
  pm2 restart "$API_SERVICE" --update-env && ok "PM2 $API_SERVICE reiniciado" || warn "Falha ao reiniciar $API_SERVICE"
}

prisma_push() {
  echo ""
  echo "=== Prisma DB Push ==="
  cd "$BACKEND" || { err "Pasta backend não encontrada"; return 1; }
  npx prisma db push && ok "Schema aplicado (db push)" || { err "Falha no prisma db push"; return 1; }
  cd "$SCRIPT_DIR"
  pm2 restart "$API_SERVICE" --update-env && ok "PM2 $API_SERVICE reiniciado" || warn "Falha ao reiniciar $API_SERVICE"
}

prisma_migrate() {
  echo ""
  echo "=== Prisma Migrate Dev ==="
  warn "Este comando requer permissão de shadow database. Use db push em produção."
  read -r -p "Continuar mesmo assim? (s/N): " confirm
  [[ "$confirm" =~ ^[Ss]$ ]] || { warn "Cancelado."; return 0; }
  cd "$BACKEND" || { err "Pasta backend não encontrada"; return 1; }
  npx prisma migrate dev && ok "Migration aplicada" || { err "Falha no prisma migrate dev"; return 1; }
  cd "$SCRIPT_DIR"
  pm2 restart "$API_SERVICE" --update-env && ok "PM2 $API_SERVICE reiniciado" || warn "Falha ao reiniciar $API_SERVICE"
}

deploy_full() {
  echo ""
  echo "=== Deploy Completo ==="
  build_backend && build_frontend && prisma_push
  echo ""
  ok "Deploy completo finalizado."
}

show_status() {
  echo ""
  echo "=== Status PM2 ==="
  pm2 status "$API_SERVICE" "$WEB_SERVICE" 2>/dev/null || pm2 list
}

while true; do
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║     JurisControl — Deploy Helper     ║"
  echo "╠══════════════════════════════════════╣"
  echo "║  1) Build Frontend                   ║"
  echo "║  2) Build Backend                    ║"
  echo "║  3) Prisma DB Push  (produção)       ║"
  echo "║  4) Prisma Migrate Dev               ║"
  echo "║  5) Deploy Completo (2 + 1 + 3)      ║"
  echo "║  6) Status PM2                       ║"
  echo "║  0) Sair                             ║"
  echo "╚══════════════════════════════════════╝"
  read -r -p "Escolha uma opção: " opt
  case "$opt" in
    1) build_frontend ;;
    2) build_backend ;;
    3) prisma_push ;;
    4) prisma_migrate ;;
    5) deploy_full ;;
    6) show_status ;;
    0) echo "Saindo."; exit 0 ;;
    *) warn "Opção inválida." ;;
  esac
done
