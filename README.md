# JurisControl

Sistema de gestão jurídica SaaS voltado para advogados autônomos e pequenos escritórios no Brasil. Cobre o ciclo completo de um processo judicial: captação do cliente, organização de documentos, geração de peças, audiências, notificações de tribunal, financeiro, IA e comunicação via WhatsApp.

---

## Módulos implementados

### Autenticação e controle de acesso
- Login com JWT (access token 15min + refresh token 7 dias)
- OAuth2 Microsoft (OneDrive + Outlook) e Google (Drive + Calendar) simultâneos
- RBAC com três papéis: `advogado`, `assistente`, `cliente`
- Renovação automática de tokens Microsoft e Google via middleware

### CRM de Clientes
- Cadastro completo com CPF, RG, endereço, WhatsApp
- Validação de CPF com algoritmo completo
- Ficha do cliente com datatable de processos (abas Ativos / Histórico)
- Status de processo por cor: aberto, em andamento, aguardando audiência, ganho, perdido, acordo, arquivado
- Geração de link de intake para o cliente preencher dados e enviar documentos

### Portal de Intake (cliente preenche sem login)
- Dois tipos de link: novo cliente (cria Client + Process) e cliente existente (atualiza dados ou novo caso)
- Formulário público sem sidebar, com logo do escritório
- Upload incremental de documentos via token único
- Registro LGPD obrigatório no submit
- Geração automática de procuração PDF ao concluir o intake

### Intake Interno (advogado preenche no lugar do cliente)
- Página `/clients/:id/intake?process=:processId`
- Dropdown de seleção de processo com pré-seleção via URL
- Upload de documentos com detecção automática de PDF criptografado
- Modal de senha quando PDF está protegido — desbloqueado via `qpdf` antes de salvar
- Campo "Resumo do Caso" que salva `case_description` no processo

### Templates de Peças Jurídicas
- CRUD de templates HTML com variáveis (`{{nome}}`, `{{cpf}}`, `{{oab}}`, `{{data_hoje}}` etc.)
- Geração de PDF via Puppeteer (HTML → PDF com formatação real)
- Dois modos de assinatura: manual (linha de assinatura impressa) e Gov.br (instrução + link assinador.iti.br)
- Template padrão de procuração ad judicia com `is_default=true`

### Upload de Documentos
- Suporte: JPG, PNG, WEBP, PDF (máx 50MB)
- Detecção de PDF criptografado via `pdf-lib`
- Remoção de senha via `qpdf --decrypt`; fallback gracioso se `qpdf` não estiver instalado
- Hash SHA-256 de integridade em todo arquivo salvo
- Desbloqueio pós-upload via `POST /api/processes/:id/documents/:docId/unlock`

### Montador de Petição (PetitionAssembler)
- Layout em dois painéis independentes
- **Painel esquerdo — Requerimento:** editor rico pré-carregado com o resumo do caso; gera `requerimento.pdf`
- **Painel direito — Documentação:** checklist de documentos obrigatórios, drag-and-drop com rotação por página individual, gera `documentacao.pdf`
- Os dois PDFs são baixados separadamente para anexar no PJe/Eproc

### Armazenamento (OneDrive + Google Drive)
- Interface abstrata `IStorageProvider` — nunca chamar OneDrive/Drive diretamente
- `StorageService` orquestra conforme `user.storage_provider`
- Criação automática de estrutura de pastas ao criar processo

### Upload de Vídeo (sem passar pelo servidor)
- Frontend faz upload direto ao OneDrive/Google Drive via URL de sessão
- Chunks de 5MB com barra de progresso
- PDF de relação de mídias com título, data, link e QR Code

### Calendário e Audiências
- Interface abstrata `ICalendarProvider` para Outlook e Google Calendar
- FullCalendar no frontend com eventos unificados sem duplicatas
- Drag-and-drop para reagendar sincroniza todos os providers ativos

### Notificações de Tribunal (PJe/Eproc)
- Job cron lê emails do Outlook a cada 15 minutos
- Gemini Flash extrai número do processo, tipo de movimentação e prazo
- Cria `CourtNotification` vinculada ao processo pelo número CNJ
- Envio imediato de WhatsApp se urgente (prazo < 5 dias)
- Botão "Abrir no Tribunal" gera deep link por `court_system` + estado CNJ

### WhatsApp Bot
- Integração via Evolution API
- Máquina de estados por conversa (`WhatsAppSession`)
- Respostas automáticas para clientes (processos, audiências, documentos)
- Comandos para advogado (resumo de cliente, pagamentos, prazos)
- Lembretes D-3, D-2, D-1 para audiências (clientes e advogado)
- Fallback inteligente via Gemini para mensagens não reconhecidas

### Financeiro
- Honorários: valor da causa × percentual (default 30%)
- Parcelamento automático com datas mensais
- Desfechos do processo com honorário de êxito opcional
- Alertas de parcelas vencidas via WhatsApp
- Dashboard financeiro: total a receber, recebido no mês, atrasos

### IA com Gemini
- Resumo automático do processo ao concluir o intake
- Classificação automática de documentos no upload
- Parse de email de tribunal (extrai número, tipo, prazo)
- Respostas empáticas no bot WhatsApp para mensagens fora do script
- Badge "✦ IA" nos documentos classificados automaticamente

### Dashboard
- Cards: total de processos, ativos, audiências da semana, honorários a receber, notificações urgentes, solicitações de novo caso
- Mini calendário dos próximos 7 dias com audiências por ícone
- Gráficos CSS: processos por status (barras), receita dos últimos 6 meses
- Alertas consolidados: prazos vencidos, parcelas atrasadas, notificações urgentes

### Portal do Cliente (Área do Membro)
- Login separado em `/portal/login` — sem sidebar do sistema
- Credenciais geradas automaticamente pelo advogado via botão "Ativar Portal" na ficha do cliente; enviadas por WhatsApp
- Role `cliente` com JWT contendo `client_id`
- Acompanhamento de processos, upload de documentos pendentes
- Bloqueio de edição quando PDF final gerado ou processo encerrado
- Alerta de troca de senha obrigatória no primeiro acesso
- Formulário de solicitação de novo caso (descrição, área, urgência) → advogado converte em processo com um clique

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Linguagem | TypeScript (strict) |
| Framework | Express 4 |
| Banco de dados | MySQL 8 via Prisma 5 ORM |
| Autenticação | JWT + Refresh Token + RBAC |
| Validação | Zod em todas as rotas |
| Upload | Multer |
| PDF (geração) | puppeteer-core + @sparticuz/chromium |
| PDF (mesclagem) | pdf-lib |
| PDF (desbloqueio) | qpdf (ferramenta de sistema) |
| Imagens | sharp |
| Frontend | React 18 + Vite + TypeScript |
| UI | Bootstrap 5 (template Veinx) |
| Estado global | Zustand + Zustand/persist |
| HTTP client | Axios + interceptors (auto refresh) |
| Calendário UI | FullCalendar.js |
| Drag-and-drop | @dnd-kit/core |
| PDF Viewer | react-pdf |
| WhatsApp | Evolution API |
| IA | Google Gemini Flash |
| Agendamento | node-cron |
| Processo | PM2 |
| Infra | VPS CloudPanel (Nginx + MySQL) |

---

## Estrutura de pastas

```
m3br-juridico/
├── backend/
│   ├── ecosystem.config.js       ← PM2 config
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts               ← Dados iniciais de exemplo
│   └── src/
│       ├── config/               ← database, microsoft, google, gemini
│       ├── middleware/           ← auth, rbac, errorHandler
│       ├── controllers/          ← um por módulo
│       ├── routes/               ← Express routers
│       ├── services/             ← PDFService, StorageService, GeminiService...
│       └── jobs/                 ← courtMonitoringJob, hearingRemindersJob
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Auth/
│       │   ├── Clients/
│       │   ├── Processes/
│       │   ├── Financial/
│       │   ├── Dashboard/
│       │   ├── Portal/           ← Portal do cliente (layout separado)
│       │   ├── CaseRequests/     ← Solicitações de novo caso (advogado)
│       │   └── Settings/
│       ├── store/                ← authStore, portalStore
│       └── services/             ← api.ts, portalApi.ts
├── nginx.conf                    ← Config Nginx SPA + proxy
└── deploy.sh                     ← Script de deploy completo
```

---

## Variáveis de ambiente (`backend/.env`)

```env
# App
NODE_ENV=production
PORT=3333
FRONTEND_URL=https://lex.m3br.com.br
JWT_SECRET=                        # gerar com: openssl rand -hex 64
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=                # gerar com: openssl rand -hex 64
JWT_REFRESH_EXPIRES_IN=7d
INTERNAL_API_KEY=                  # chave para rotas internas (n8n)

# Banco
DATABASE_URL="mysql://usuario:senha@127.0.0.1:3306/juriscontrol"

# Microsoft (OneDrive + Outlook)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=https://lex.m3br.com.br/auth/microsoft/callback
MICROSOFT_SCOPES=Files.ReadWrite.All Calendars.ReadWrite Mail.Read offline_access User.Read

# Google (Drive + Calendar)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://lex.m3br.com.br/auth/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar offline_access

# Storage / Calendar
STORAGE_PROVIDER=onedrive         # onedrive | googledrive | ambos
CALENDAR_PROVIDER=outlook         # outlook | google | ambos

# WhatsApp (Evolution API)
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=https://wpp.m3br.com.br
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=

# IA
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# Upload
UPLOAD_TEMP_DIR=/tmp/juriscontrol
MAX_FILE_SIZE=50mb
```

---

## Primeiro deploy (do zero)

### 1. Dependências de sistema

```bash
sudo apt-get update
sudo apt-get install -y \
  libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2t64 qpdf
```

### 2. Instalar dependências do projeto

```bash
cd ~/htdocs/lex.m3br.com.br/backend  && npm install
cd ~/htdocs/lex.m3br.com.br/frontend && npm install
```

### 3. Banco de dados

```bash
cd ~/htdocs/lex.m3br.com.br/backend
npx prisma migrate deploy
```

### 4. Seed — dados iniciais de exemplo

```bash
cd ~/htdocs/lex.m3br.com.br/backend
npm run seed
```

Cria automaticamente:
| Item | Detalhe |
|---|---|
| Usuário advogado | `adv@lex.m3br.com.br` / senha `Admin@2026` |
| Settings | Percentual padrão 30%, Outlook, OneDrive |
| Template | Procuração ad judicia (padrão) |
| Cliente 1 | João Carlos da Silva — CPF 123.456.789-00 |
| Cliente 2 | Maria Aparecida Souza — CPF 987.654.321-00 |
| Processo | Indenização por Acidente de Trânsito (em andamento) |
| Audiência | Conciliação agendada em 20 dias |
| Financeiro | Honorários R$ 3.000 em 3x (1ª paga) |
| Monitoramento | Domínio `pje.jus.br` ativo |

> **Troque a senha no primeiro acesso.**

### 5. Build do frontend

```bash
cd ~/htdocs/lex.m3br.com.br/frontend
npm run build
```

### 6. Iniciar com PM2

```bash
# API (backend)
cd ~/htdocs/lex.m3br.com.br/backend
npm run build
pm2 start ecosystem.config.js

# Frontend (arquivos estáticos — CloudPanel proxy para porta 5174)
pm2 serve ~/htdocs/lex.m3br.com.br/frontend/dist 5174 --name juriscontrol-web --spa

pm2 save

# Ativar reinício automático no boot (copiar e colar o comando gerado)
pm2 startup
```

### 7. Nginx

```bash
sudo cp ~/htdocs/lex.m3br.com.br/nginx.conf /etc/nginx/sites-available/juriscontrol
sudo ln -sf /etc/nginx/sites-available/juriscontrol /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Deploy de atualização

```bash
cd ~/htdocs/lex.m3br.com.br
bash deploy.sh
```

O script (`deploy.sh`):
1. Build do frontend (`npm run build`)
2. Build do backend (`npm run build` + `prisma generate`)
3. `pm2 restart juriscontrol-api`

---

## URLs do sistema

| URL | Descrição |
|---|---|
| `https://lex.m3br.com.br/` | Redireciona para `/dashboard` |
| `https://lex.m3br.com.br/login` | Login do advogado/assistente |
| `https://lex.m3br.com.br/portal/login` | Login do cliente (portal) |
| `https://lex.m3br.com.br/intake/:token` | Formulário público de intake |
| `https://lex.m3br.com.br/api/...` | API REST (proxy Nginx → porta 3333) |

---

## Limitações conhecidas

- **PJe/Eproc API:** A API do PJe é interna ao CNJ e não aceita autenticação de sistemas externos. Fluxo correto: gerar o PDF no JurisControl e o advogado anexa manualmente no portal do tribunal.
- **qpdf:** Deve estar instalado no servidor para remoção de senha em PDFs criptografados. Se ausente, PDFs ficam com `requires_password=true` e podem ser desbloqueados depois.
- **Puppeteer em VPS:** Requer dependências de sistema listadas acima. Sem elas, o PDF não é gerado.
- **Evolution API:** Precisa de instância WhatsApp conectada e configurada nas Settings do advogado para o bot e alertas funcionarem.
