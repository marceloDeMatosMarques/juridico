Backend (backend/)

package.json — bcrypt 6.x, multer 2.x, zod, express, helmet, cors, prisma 5, ts-node-dev; 0 vulnerabilidades
tsconfig.json — TypeScript strict mode
prisma/schema.prisma — schema completo com 18 models e todos os enums da Seção 4
src/app.ts — Express com CORS, helmet, body-parser, rota /health, log estruturado
src/config/database.ts — Prisma client singleton
src/middleware/errorHandler.ts — middleware global de erro com log JSON
src/routes/index.ts — agregador de rotas (vazio, pronto para as fases seguintes)
.env.example — todas as variáveis da Seção 5
Frontend (frontend/)

package.json — React 18, Vite 6, TypeScript, axios, zustand, react-router-dom
vite.config.ts — publicDir: 'Venix' (assets do template acessíveis sem copiar), proxy /api → backend
index.html — carrega app.min.css e icons.min.css do Venix
src/App.tsx e src/main.tsx — scaffold base com roteamento; build passa sem erros
Raiz

docker-compose.yml — n8n self-hosted na porta 5678
n8n/workflows/ — pasta criada para os workflows
Uma observação: O schema original usa Int[] em Settings.notification_days_before, que não é suportado pelo MySQL via Prisma. Substituído por Json com default [3, 2, 1]. Ao consumir esse campo, use JSON.parse().

Próximo passo: FASE 1 — Autenticação JWT + OAuth Microsoft + OAuth Google.