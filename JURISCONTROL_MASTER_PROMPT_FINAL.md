# JURISCONTROL — MASTER PROMPT PARA DESENVOLVIMENTO EM FASES
> Utilize este arquivo como contexto completo ao iniciar cada fase no Cursor, Claude Code, Windsurf ou Antigravity.
> **Regra:** Inicie cada sessão colando este arquivo + o arquivo da fase que está desenvolvendo. Nunca cole todas as fases de uma vez.

---

## 1. VISÃO GERAL DO PROJETO

**JurisControl** é um sistema de gestão jurídica SaaS voltado para advogados autônomos e pequenos escritórios no Brasil. Permite que advogados, assistentes e clientes colaborem no fluxo completo de um processo judicial, desde a captação do cliente até o desfecho e controle financeiro.

**Repositório:** `juriscontrol/`
**Língua:** 100% Português Brasileiro (interface, mensagens, logs)
**Ambiente:** VPS com CloudPanel (Nginx + MySQL 8 + Node.js 20+)

---

## 2. STACK TECNOLÓGICA DEFINITIVA

### Backend
- **Runtime:** Node.js 20+ com TypeScript (strict mode)
- **Arquitetura:** MVC (Models → Controllers → Routes)
- **Framework:** Express.js
- **Banco:** MySQL 8.0 via Prisma ORM
- **Auth:** JWT (access 15min) + Refresh Token (7 dias) + RBAC por role
- **Validação:** Zod em todos os endpoints
- **Upload coordenador:** Multer (apenas metadados — arquivos vão direto ao storage provider)
- **PDF:** pdf-lib + sharp
- **Agendamento:** node-cron
- **Filas/Workflows:** n8n self-hosted
- **WhatsApp:** Evolution API (provider abstraído — ver seção 9)
- **IA:** Google Gemini Flash via `@google/generative-ai`
- **Processo em produção:** PM2

### Frontend
- **Base:** Template **Veinx** (Bootstrap 5 + componentes pré-estilizados) — pasta `/venix`
- **Framework:** React 18 + Vite + TypeScript
- **UI:** Componentes do Veinx devem ser usados sempre que disponíveis. Não criar componentes Bootstrap do zero.
- **Calendário:** FullCalendar.js (exibe eventos de ambos os providers simultaneamente)
- **Estado global:** Zustand
- **HTTP:** Axios com interceptors para refresh de token
- **PDF Viewer:** react-pdf
- **Drag-and-drop:** @dnd-kit/core

### Infraestrutura — Providers Abstraídos
Todos os serviços de armazenamento e calendário usam interfaces abstratas.
O advogado configura qual provider usar nas Configurações. Ambos podem estar ativos simultaneamente.

| Serviço | Provider A | Provider B | Configuração |
|---------|-----------|-----------|--------------|
| Armazenamento de vídeos/docs | Microsoft OneDrive | Google Drive | `STORAGE_PROVIDER=onedrive\|googledrive\|ambos` |
| Calendário de audiências | Microsoft Outlook | Google Calendar | `CALENDAR_PROVIDER=outlook\|google\|ambos` |
| Email (monitor PJe/Eproc) | Microsoft Outlook | Gmail (futuro) | `EMAIL_PROVIDER=outlook` |
| WhatsApp | Evolution API | Meta Business API (futuro) | `WHATSAPP_PROVIDER=evolution` |

- **CI/CD:** PM2 + scripts de deploy no CloudPanel

---

## 3. ESTRUTURA DE PASTAS MVC

```
juriscontrol/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          ← Prisma client singleton
│   │   │   ├── microsoft.ts         ← Microsoft Graph API config
│   │   │   ├── google.ts            ← Google OAuth2 + APIs config
│   │   │   ├── whatsapp.ts          ← WhatsApp provider config
│   │   │   └── gemini.ts            ← Gemini API config
│   │   ├── middleware/
│   │   │   ├── auth.ts              ← JWT verify + attach user
│   │   │   ├── rbac.ts              ← Role-based access control
│   │   │   ├── refreshMsToken.ts    ← Auto-refresh Microsoft token
│   │   │   ├── refreshGoogleToken.ts← Auto-refresh Google token
│   │   │   ├── upload.ts            ← Multer (metadata only)
│   │   │   ├── validate.ts          ← Zod schema validator
│   │   │   └── errorHandler.ts      ← Global error middleware
│   │   ├── models/                  ← Tipos TypeScript espelhando Prisma schema
│   │   │   ├── User.ts
│   │   │   ├── Client.ts
│   │   │   ├── Process.ts
│   │   │   └── ...
│   │   ├── controllers/             ← Lógica de negócio (um por módulo)
│   │   │   ├── auth.controller.ts
│   │   │   ├── clients.controller.ts
│   │   │   ├── processes.controller.ts
│   │   │   ├── documents.controller.ts
│   │   │   ├── videos.controller.ts
│   │   │   ├── hearings.controller.ts
│   │   │   ├── financial.controller.ts
│   │   │   ├── whatsapp.controller.ts
│   │   │   ├── courtNotifications.controller.ts
│   │   │   ├── templates.controller.ts
│   │   │   ├── intake.controller.ts
│   │   │   └── dashboard.controller.ts
│   │   ├── routes/                  ← Express routers
│   │   │   ├── index.ts             ← Agrega todas as rotas
│   │   │   ├── auth.routes.ts
│   │   │   ├── clients.routes.ts
│   │   │   ├── processes.routes.ts
│   │   │   ├── documents.routes.ts
│   │   │   ├── videos.routes.ts
│   │   │   ├── hearings.routes.ts
│   │   │   ├── financial.routes.ts
│   │   │   ├── whatsapp.routes.ts
│   │   │   ├── courtNotifications.routes.ts
│   │   │   ├── templates.routes.ts
│   │   │   ├── intake.routes.ts     ← Rotas públicas (token-based)
│   │   │   ├── internal.routes.ts   ← Apenas para n8n (API key)
│   │   │   └── dashboard.routes.ts
│   │   ├── services/                ← Integrações externas
│   │   │   ├── storage/
│   │   │   │   ├── IStorageProvider.ts      ← Interface abstrata de armazenamento
│   │   │   │   ├── OneDriveProvider.ts      ← Microsoft OneDrive
│   │   │   │   └── GoogleDriveProvider.ts   ← Google Drive
│   │   │   ├── StorageService.ts            ← Orquestra um ou ambos providers
│   │   │   ├── calendar/
│   │   │   │   ├── ICalendarProvider.ts     ← Interface abstrata de calendário
│   │   │   │   ├── OutlookCalendarProvider.ts
│   │   │   │   └── GoogleCalendarProvider.ts
│   │   │   ├── CalendarService.ts           ← Orquestra um ou ambos providers
│   │   │   ├── MicrosoftGraphService.ts     ← Base Graph API (mail + token)
│   │   │   ├── GoogleAPIService.ts          ← Base Google API (oauth + token)
│   │   │   ├── OutlookMailService.ts        ← Leitura email PJe/Eproc
│   │   │   ├── PDFService.ts
│   │   │   ├── WhatsAppService.ts
│   │   │   ├── providers/
│   │   │   │   ├── IWhatsAppProvider.ts
│   │   │   │   └── EvolutionAPIProvider.ts
│   │   │   ├── GeminiService.ts
│   │   │   └── NotificationService.ts
│   │   ├── jobs/
│   │   │   └── reminderJob.ts       ← node-cron (fallback sem n8n)
│   │   └── app.ts                   ← Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── venix/                       ← Template Veinx — NÃO MODIFICAR arquivos aqui
│   │   └── (componentes Bootstrap pré-estilizados)
│   ├── src/
│   │   ├── components/              ← Componentes que ESTENDEM os do Veinx
│   │   │   ├── Layout/
│   │   │   ├── PDFUnifier/          ← drag-and-drop ordenação
│   │   │   ├── VideoUploader/       ← upload direto OneDrive com progresso
│   │   │   ├── Calendar/            ← wrapper FullCalendar
│   │   │   ├── WhatsApp/            ← QR Code connect
│   │   │   └── DocumentViewer/      ← react-pdf viewer
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── Auth/
│   │   │   ├── Clients/
│   │   │   ├── Processes/
│   │   │   ├── Documents/
│   │   │   ├── Videos/
│   │   │   ├── Calendar/
│   │   │   ├── Financial/
│   │   │   ├── Templates/
│   │   │   ├── Settings/
│   │   │   └── Intake/              ← Portal público do cliente
│   │   ├── store/                   ← Zustand stores
│   │   ├── services/
│   │   │   └── api.ts               ← Axios + interceptors
│   │   └── types/                   ← TypeScript interfaces
│   └── package.json
│
├── n8n/
│   └── workflows/
│       ├── hearing-reminders.json
│       ├── court-email-monitor.json
│       └── document-notifications.json
│
└── docker-compose.yml               ← Para n8n local
```

---

## 4. SCHEMA PRISMA COMPLETO

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─── AUTENTICAÇÃO E PAPÉIS ─────────────────────────────

enum Role {
  advogado
  assistente
  cliente
}

model User {
  id                        String    @id @default(uuid())
  name                      String
  email                     String    @unique
  password_hash             String
  phone                     String?
  role                      Role      @default(advogado)
  oab_number                String?
  oab_state                 String?
  // Microsoft OAuth
  microsoft_access_token    String?   @db.Text
  microsoft_refresh_token   String?   @db.Text
  microsoft_token_expires_at DateTime?
  // Google OAuth
  google_access_token       String?   @db.Text
  google_refresh_token      String?   @db.Text
  google_token_expires_at   DateTime?
  google_email              String?   // email da conta Google conectada
  // Preferências de provider
  storage_provider          String    @default("onedrive") // "onedrive" | "googledrive" | "ambos"
  calendar_provider         String    @default("outlook")  // "outlook" | "google" | "ambos"
  // WhatsApp
  whatsapp_connected        Boolean   @default(false)
  whatsapp_instance_id      String?
  // Relações
  clients                   Client[]
  processes                 Process[]
  hearings                  Hearing[]
  financial_records         FinancialRecord[]
  whatsapp_messages         WhatsAppMessage[]
  templates                 DocumentTemplate[]
  court_notifications       CourtNotification[]
  settings                  Settings?
  created_at                DateTime  @default(now())
  updated_at                DateTime  @updatedAt
}

// ─── CLIENTES (CRM) ────────────────────────────────────

enum ClientStatus {
  ativo
  inativo
}

model Client {
  id              String       @id @default(uuid())
  user_id         String
  user            User         @relation(fields: [user_id], references: [id])
  full_name       String
  cpf             String?
  rg              String?
  birth_date      DateTime?
  email           String?
  phone           String?
  whatsapp        String?
  address         String?
  address_number  String?
  complement      String?
  neighborhood    String?
  city            String?
  state           String?
  zip_code        String?
  notes           String?      @db.Text
  // Identidade de gênero e nome social
  gender          String?      // "M" | "F" | "NB" | "outro" — usado na procuração para flexão
  social_name     String?      // Nome social (prevalece sobre full_name na procuração quando preenchido)
  marital_status  String?      // "solteiro" | "casado" | "divorciado" | "viúvo" | "união_estável"
  nationality     String?      @default("Brasileiro")  // Flexionado automaticamente por gender
  profession      String?      // Profissão do cliente
  status          ClientStatus @default(ativo)
  deleted_at      DateTime?    // Soft delete — nunca deletar fisicamente
  // Portal do cliente (Fase 13)
  portal_user_id  String?      @unique
  portal_enabled  Boolean      @default(false)
  processes       Process[]
  whatsapp_messages WhatsAppMessage[]
  consents        Consent[]
  intake_tokens   IntakeToken[]
  created_at      DateTime     @default(now())
  updated_at      DateTime     @updatedAt
}

// ─── LGPD — CONSENTIMENTO ─────────────────────────────

model Consent {
  id          String    @id @default(uuid())
  client_id   String
  client      Client    @relation(fields: [client_id], references: [id])
  purpose     String    // "gestao_processo", "comunicacao_whatsapp", etc.
  granted_at  DateTime  @default(now())
  revoked_at  DateTime?
  ip_address  String?
  user_agent  String?
}

// ─── TOKENS DE INTAKE (portal público do cliente) ────

model IntakeToken {
  id          String    @id @default(uuid())
  process_id  String?
  client_id   String?
  client      Client?   @relation(fields: [client_id], references: [id])
  token       String    @unique @default(uuid())
  expires_at  DateTime
  used_at     DateTime?
  metadata    Json?     // instruções, campos solicitados, etc.
  created_at  DateTime  @default(now())
}

// ─── TEMPLATES DE PEÇAS JURÍDICAS ───────────────────

enum TemplateType {
  procuracao
  contrato_honorarios
  notificacao_extrajudicial
  requerimento
  outro
}

model DocumentTemplate {
  id           String       @id @default(uuid())
  user_id      String
  user         User         @relation(fields: [user_id], references: [id])
  name         String
  type         TemplateType
  content_html String       @db.LongText  // HTML com variáveis {{nome}}, {{cpf}}, etc.
  variables    Json          // lista das variáveis disponíveis
  is_default   Boolean      @default(false)
  created_at   DateTime     @default(now())
  updated_at   DateTime     @updatedAt
}

// ─── PROCESSOS JUDICIAIS ─────────────────────────────

enum ProcessStatus {
  aberto
  em_andamento
  aguardando_audiencia
  encerrado
  ganho
  perdido
  acordo
  arquivado
}

enum ProcessType {
  civil_consumidor
  civil_indenizatorio
  civil_obrigacional
  trabalhista
  criminal
  previdenciario
  familia
  tributario
  administrativo
  outro
}

enum CourtSystem {
  pje
  eproc
  projudi
  saj
  esaj
  manual
}

model Process {
  id                    String        @id @default(uuid())
  user_id               String
  user                  User          @relation(fields: [user_id], references: [id])
  client_id             String
  client                Client        @relation(fields: [client_id], references: [id])
  process_number        String?       // Máscara: NNNNNNN-DD.AAAA.J.TT.OOOO
  case_title            String
  case_description      String?       @db.Text
  court                 String?
  judge                 String?
  opposing_party        String?
  process_type          ProcessType   @default(civil_consumidor)
  status                ProcessStatus @default(aberto)
  open_date             DateTime      @default(now())
  close_date            DateTime?
  // Sistemas judiciais
  court_system          CourtSystem?
  court_email_domain    String?       // ex: "pje.jus.br"
  oab_process_link      String?       @db.Text
  last_court_notification_at DateTime?
  pending_deadline      DateTime?
  // OneDrive
  onedrive_folder_id    String?
  onedrive_folder_url   String?
  // PDFs gerados
  summary_pdf_url       String?       @db.Text
  summary_pdf_onedrive_id String?
  // AI
  ai_summary            String?       @db.Text
  // Google Drive (equivalente ao onedrive_folder_id)
  google_drive_folder_id  String?
  google_drive_folder_url String?
  // Soft delete
  deleted_at            DateTime?
  // Intake
  intake_completed_at   DateTime?
  // Relações
  documents             ProcessDocument[]
  hearings              Hearing[]
  financial_records     FinancialRecord[]
  timeline              ProcessTimeline[]
  outcomes              ProcessOutcome[]
  court_notifications   CourtNotification[]
  video_annexes         VideoAnnex[]
  created_at            DateTime      @default(now())
  updated_at            DateTime      @updatedAt
}

// ─── DOCUMENTOS ──────────────────────────────────────

enum DocumentType {
  procuracao
  identidade
  cpf
  cnh
  comprovante_residencia
  nota_fiscal
  contrato
  foto_evidencia
  video_link
  pdf_unificado
  pdf_videos
  extra
}

enum StorageType {
  onedrive
  physical
  external_link
}

model ProcessDocument {
  id                    String       @id @default(uuid())
  process_id            String
  process              Process      @relation(fields: [process_id], references: [id])
  document_type         DocumentType
  file_name             String
  file_url              String?      @db.Text   // URL local /api/downloads/<filename>
  onedrive_item_id      String?
  onedrive_share_link   String?      @db.Text
  google_drive_item_id  String?
  google_drive_share_link String?    @db.Text
  is_public             Boolean      @default(false)
  file_type             String?      // pdf, image, video, link
  file_size             Int?         // bytes
  file_hash             String?      // SHA-256 para integridade
  storage_type          StorageType  @default(onedrive)
  physical_location     String?      // Para mídia física
  physical_custody_date DateTime?
  external_link_description String?  @db.Text
  upload_date           DateTime     @default(now())
  notes                 String?      @db.Text
  order_index           Int          @default(0)
  uploaded_by_role      Role?        // quem fez o upload
  // Rotação (non-destructive) — aplicada apenas na geração do PDF final
  rotation              Int          @default(0)   // 0 | 90 | 180 | 270
  // PDF e Assinatura
  file_password         String?      // hash bcrypt da senha (quando aplicável)
  requires_password     Boolean      @default(false)  // PDF enviado pelo cliente com senha não removida
  signature_type        String?      // "manual" | "govbr"
  signature_status      String?      // "pending" | "signed"
}

// ─── ANEXO DE VÍDEOS (PDF de relação de mídias) ─────

model VideoAnnex {
  id                String    @id @default(uuid())
  process_id        String
  process           Process   @relation(fields: [process_id], references: [id])
  title             String
  pdf_url           String?   @db.Text
  onedrive_item_id  String?
  public_share_link String?   @db.Text   // OneDrive link
  google_drive_item_id   String?
  google_drive_share_link String? @db.Text  // Google Drive link
  storage_provider_used  String  @default("onedrive") // qual foi usado na geração
  document_ids      Json      // IDs dos ProcessDocuments incluídos
  file_hash         String?   // SHA-256 do PDF gerado
  generated_by      String    // user_id
  generated_at      DateTime  @default(now())
}

// ─── AUDIÊNCIAS ──────────────────────────────────────

enum HearingType {
  audiencia_instrucao
  audiencia_conciliacao
  audiencia_julgamento
  reuniao_cliente
  prazo_processual
  diligencia
  pericia
}

enum HearingStatus {
  agendada
  realizada
  cancelada
  adiada
}

model Hearing {
  id                  String        @id @default(uuid())
  process_id          String
  process             Process       @relation(fields: [process_id], references: [id])
  user_id             String
  user                User          @relation(fields: [user_id], references: [id])
  title               String
  description         String?       @db.Text
  hearing_date        DateTime
  hearing_time        String
  location            String?
  hearing_type        HearingType   @default(audiencia_instrucao)
  outlook_event_id    String?
  google_event_id     String?   // Google Calendar event ID
  teams_meeting_url   String?       @db.Text
  // Lembretes — controle individual por dia
  reminder_d3_sent    Boolean       @default(false)
  reminder_d2_sent    Boolean       @default(false)
  reminder_d1_sent    Boolean       @default(false)
  reminder_adv_d3     Boolean       @default(false)
  reminder_adv_d2     Boolean       @default(false)
  reminder_adv_d1     Boolean       @default(false)
  status              HearingStatus @default(agendada)
  created_at          DateTime      @default(now())
  updated_at          DateTime      @updatedAt
}

// ─── FINANCEIRO ──────────────────────────────────────

enum RecordType {
  honorario
  despesa
  reembolso
  honorario_exito
}

enum PaymentStatus {
  pendente
  parcial
  pago
  cancelado
  atrasado
}

enum PaymentType {
  unico
  parcelado
}

model FinancialRecord {
  id                  String        @id @default(uuid())
  process_id          String
  process             Process       @relation(fields: [process_id], references: [id])
  user_id             String
  user                User          @relation(fields: [user_id], references: [id])
  record_type         RecordType
  description         String
  total_value         Decimal       @db.Decimal(12, 2)
  cause_value         Decimal?      @db.Decimal(12, 2)
  percentage          Decimal       @default(30.00) @db.Decimal(5, 2)
  calculated_fee      Decimal?      @db.Decimal(12, 2)
  payment_status      PaymentStatus @default(pendente)
  payment_type        PaymentType   @default(unico)
  installments_total  Int           @default(1)
  installments_paid   Int           @default(0)
  due_date            DateTime?
  paid_date           DateTime?
  success_fee_applied Boolean       @default(false)
  notes               String?       @db.Text
  installments        Installment[]
  created_at          DateTime      @default(now())
  updated_at          DateTime      @updatedAt
}

model Installment {
  id                    String        @id @default(uuid())
  financial_record_id   String
  financial_record      FinancialRecord @relation(fields: [financial_record_id], references: [id])
  installment_number    Int
  value                 Decimal       @db.Decimal(12, 2)
  due_date              DateTime
  paid_date             DateTime?
  status                PaymentStatus @default(pendente)
  payment_method        String?
  receipt_url           String?       @db.Text
  whatsapp_notified     Boolean       @default(false)
}

// ─── DESFECHOS DO PROCESSO ───────────────────────────

enum OutcomeType {
  acordo_extrajudicial      // sem audiência
  acordo_judicial           // após audiência
  sentenca_procedente       // ganhou
  sentenca_improcedente     // perdeu
  recurso_provido
  recurso_desprovido
  extincao_sem_merito
}

model ProcessOutcome {
  id                    String      @id @default(uuid())
  process_id            String
  process               Process     @relation(fields: [process_id], references: [id])
  outcome_type          OutcomeType
  agreed_value          Decimal?    @db.Decimal(12, 2)
  outcome_date          DateTime
  hearing_id            String?     // audiência em que ocorreu (se aplicável)
  success_fee_applied   Boolean     @default(false)
  success_fee_value     Decimal?    @db.Decimal(12, 2)
  notes                 String?     @db.Text
  created_at            DateTime    @default(now())
}

// ─── NOTIFICAÇÕES DOS TRIBUNAIS (PJe/Eproc) ─────────

enum CourtNotificationSource {
  pje
  eproc
  projudi
  saj
  esaj
  email_manual
}

enum CourtNotificationType {
  despacho
  intimacao           // crítico — tem prazo
  sentenca
  acordao
  audiencia_agendada
  juntada_peca
  determinacao
  outro
}

model CourtNotification {
  id                      String                   @id @default(uuid())
  process_id              String
  process                 Process                  @relation(fields: [process_id], references: [id])
  user_id                 String
  user                    User                     @relation(fields: [user_id], references: [id])
  source                  CourtNotificationSource
  notification_type       CourtNotificationType    @default(outro)
  original_email_subject  String?
  original_email_body     String?                  @db.LongText
  parsed_content          Json?                    // extração via Gemini
  deadline_date           DateTime?
  deadline_days_remaining Int?
  is_urgent               Boolean                  @default(false)
  whatsapp_alert_sent     Boolean                  @default(false)
  received_at             DateTime                 @default(now())
}

model MonitoredCourtDomain {
  id           String  @id @default(uuid())
  user_id      String
  court_name   String  // "PJe TJRJ"
  email_domain String  // "pje.jus.br"
  court_system CourtSystem
  state        String  // "RJ"
  active       Boolean @default(true)
  created_at   DateTime @default(now())
}

// ─── WHATSAPP ────────────────────────────────────────

enum MessageDirection {
  sent
  received
}

enum MessageType {
  text
  document
  audio
  video
  image
}

enum MessageStatus {
  sent
  delivered
  read
  failed
}

model WhatsAppMessage {
  id                  String           @id @default(uuid())
  user_id             String
  user                User             @relation(fields: [user_id], references: [id])
  client_id           String?
  client              Client?          @relation(fields: [client_id], references: [id])
  process_id          String?
  direction           MessageDirection
  message_type        MessageType      @default(text)
  content             String?          @db.Text
  media_url           String?          @db.Text
  whatsapp_message_id String?
  status              MessageStatus    @default(sent)
  sent_at             DateTime         @default(now())
  created_at          DateTime         @default(now())
}

model WhatsAppSession {
  id            String   @id @default(uuid())
  phone         String   @unique
  current_state String   @default("idle")  // idle, awaiting_details, etc.
  context_data  Json?    // dados temporários da conversa
  role          Role?
  user_id       String?
  client_id     String?
  last_activity DateTime @default(now())
  updated_at    DateTime @updatedAt
}

// ─── TIMELINE DO PROCESSO ────────────────────────────

model ProcessTimeline {
  id          String   @id @default(uuid())
  process_id  String
  process     Process  @relation(fields: [process_id], references: [id])
  user_id     String?
  action_type String   // "documento_adicionado", "audiencia_agendada", etc.
  description String   @db.Text
  metadata    Json?
  created_at  DateTime @default(now())
}

// ─── CONFIGURAÇÕES DO USUÁRIO ────────────────────────

model Settings {
  id                              String   @id @default(uuid())
  user_id                         String   @unique
  user                            User     @relation(fields: [user_id], references: [id])
  default_fee_percentage          Decimal  @default(30.00) @db.Decimal(5, 2)
  // Storage
  storage_provider                String   @default("onedrive") // "onedrive" | "googledrive" | "ambos"
  onedrive_root_folder            String?  @default("JurisControl")
  google_drive_root_folder_id     String?  // ID da pasta raiz no Google Drive
  // Calendar
  calendar_provider               String   @default("outlook") // "outlook" | "google" | "ambos"
  // Notificações
  notification_days_before        Int[]    @default([3, 2, 1])
  auto_send_whatsapp_reminders    Boolean  @default(true)
  auto_monitor_court_emails       Boolean  @default(false)
  gemini_features_enabled         Boolean  @default(true)
  office_logo_url                 String?  @db.Text
  office_name                     String?
  created_at                      DateTime @default(now())
  updated_at                      DateTime @updatedAt
}
```

---

## 5. VARIÁVEIS DE AMBIENTE COMPLETAS (.env)

```env
# App
NODE_ENV=production
PORT=3001
JWT_SECRET=gerar_uuid_aleatorio_aqui
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=outro_uuid_aleatorio
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://seudominio.com.br
INTERNAL_API_KEY=chave_para_n8n_aqui

# MySQL (CloudPanel)
DATABASE_URL="mysql://usuario:senha@localhost:3306/juriscontrol"

# ── PROVIDERS DE ARMAZENAMENTO ──────────────────────────────
# Opções: "onedrive" | "googledrive" | "ambos"
STORAGE_PROVIDER=ambos

# Microsoft Graph API (OneDrive + Outlook)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=https://seudominio.com.br/auth/microsoft/callback
MICROSOFT_SCOPES=Files.ReadWrite.All Calendars.ReadWrite Mail.Read offline_access User.Read

# Google OAuth2 (Drive + Calendar)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://seudominio.com.br/auth/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar offline_access

# ── PROVIDERS DE CALENDÁRIO ─────────────────────────────────
# Opções: "outlook" | "google" | "ambos"
CALENDAR_PROVIDER=ambos

# WhatsApp — Evolution API
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=juriscontrol

# n8n
N8N_URL=http://localhost:5678
N8N_API_KEY=

# Google Gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# Upload
UPLOAD_TEMP_DIR=/tmp/juriscontrol
MAX_FILE_SIZE=50mb
```

---

## 6. REGRAS GLOBAIS DE DESENVOLVIMENTO

Estas regras se aplicam a **todas as fases**. O agente de IA deve segui-las sempre:

1. **TypeScript strict** — sem `any`, sem `@ts-ignore`, tipagem completa
2. **Zod em toda rota** — validar body, params e query antes do controller
3. **Prisma transactions** — toda operação que envolve >1 tabela usa `prisma.$transaction`
4. **Try/catch obrigatório** — todo async sem exceção; erros passam para `next(error)`
5. **Log estruturado** — usar `console.log(JSON.stringify({level, action, data}))` para operações críticas
6. **Soft delete** — nunca DELETE físico em clientes, processos ou documentos; usar campo `deleted_at` ou status
7. **Multi-tenant** — todo controller verifica que `record.user_id === req.user.id` antes de retornar ou modificar
8. **Template Veinx obrigatório** — frontend usa componentes da pasta `/venix`. Não criar Bootstrap do zero
9. **Interface WhatsApp** — nunca chamar Evolution API diretamente; sempre via `WhatsAppService`
10. **Interface Storage** — nunca chamar OneDrive ou Google Drive diretamente; sempre via `StorageService`. O service decide qual provider usar com base em `user.storage_provider`
11. **Interface Calendar** — nunca chamar Outlook ou Google Calendar diretamente; sempre via `CalendarService`. O service sincroniza em ambos quando `calendar_provider = "ambos"`
12. **Vídeos nunca passam pelo servidor** — frontend faz upload direto ao storage provider via upload session; backend apenas coordena e registra links
13. **n8n nunca acessa o banco diretamente** — comunicação via endpoints `/internal/*` protegidos por `INTERNAL_API_KEY`
14. **Mensagens 100% em português** — labels, erros, mensagens WhatsApp, logs de usuário
15. **Provider "ambos"** — quando storage_provider ou calendar_provider = "ambos", a operação é executada em paralelo (`Promise.all`) nos dois providers; falha em um não cancela o outro — registrar o erro e continuar

---

## 7. AUTENTICAÇÃO E RBAC

### Papéis e permissões
```
advogado  → acesso total ao seu escritório (todos os módulos)
assistente → clientes, processos, documentos, agenda (sem financeiro, sem configurações)
cliente    → somente seu processo via portal de intake (token) ou portal autenticado simplificado
```

### Middleware RBAC
```typescript
// middleware/rbac.ts
export const requireRole = (...roles: Role[]) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' })
    }
    next()
  }

// Uso nas rotas:
router.delete('/:id', auth, requireRole('advogado'), controller.delete)
router.get('/', auth, requireRole('advogado', 'assistente'), controller.list)
```

---

## 8. ROTAS COMPLETAS DA API

```
# AUTH
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/microsoft
GET    /auth/microsoft/callback
POST   /auth/microsoft/refresh

# CLIENTS
GET    /api/clients                             (advogado, assistente)
POST   /api/clients                             (advogado, assistente)
GET    /api/clients/:id                         (advogado, assistente)
PUT    /api/clients/:id                         (advogado, assistente)
DELETE /api/clients/:id                         (advogado) → soft delete
GET    /api/clients/:id/processes               (advogado, assistente)
GET    /api/clients/:id/whatsapp                (advogado)
GET    /api/clients/:id/check-procuracao        (advogado, assistente) → verifica se dados estão completos
POST   /api/clients/:id/generate-procuracao     (advogado, assistente) → gera PDF da procuração

# INTAKE (rotas públicas — auth por token)
GET    /api/intake/:token/status       (público) → retorna dados do cliente e do escritório
GET    /api/intake/:token/documents    (público) → lista docs já enviados ao processo
POST   /api/intake/:token/submit       (público) → salva dados + gera procuração PDF
POST   /api/intake/:token/upload       (público) → upload de documento via token
POST   /api/intake/generate            (advogado, assistente) → token para cliente existente
POST   /api/intake/generate-new        (advogado, assistente) → cria cliente + processo + token

# PORTAL DO CLIENTE (auth JWT role=cliente)
POST   /portal/login                   (público)
POST   /portal/request-password-reset  (público)
POST   /portal/reset-password/:token   (público)
GET    /api/portal/me                  (cliente)
PUT    /api/portal/me                  (cliente)
GET    /api/portal/processes           (cliente)
GET    /api/portal/processes/:id       (cliente)
GET    /api/portal/processes/:id/documents (cliente)
POST   /api/portal/processes/:id/upload    (cliente)
POST   /api/portal/new-case-request        (cliente)

# TEMPLATES
GET    /api/templates                  (advogado)
POST   /api/templates                  (advogado)
GET    /api/templates/:id              (advogado)
PUT    /api/templates/:id              (advogado)
DELETE /api/templates/:id              (advogado)
POST   /api/templates/:id/generate     (advogado, assistente) → gera PDF com dados do cliente

# PROCESSES
GET    /api/processes                  (advogado, assistente)
POST   /api/processes                  (advogado, assistente)
GET    /api/processes/:id              (advogado, assistente)
PUT    /api/processes/:id              (advogado, assistente)
DELETE /api/processes/:id              (advogado)
GET    /api/processes/:id/timeline     (advogado, assistente)
POST   /api/processes/:id/outcomes     (advogado)

# DOCUMENTS
GET    /api/processes/:id/documents                    (advogado, assistente)
POST   /api/processes/:id/documents/upload             (advogado, assistente, cliente) → multer; detecta senha PDF
PUT    /api/processes/:id/documents/:docId/rotate      (advogado, assistente) → atualiza campo rotation (non-destructive)
PUT    /api/processes/:id/documents/reorder            (advogado, assistente) → só reordena categoria 4 (docs do caso)
DELETE /api/processes/:id/documents/:docId             (advogado)
POST   /api/processes/:id/documents/:docId/unlock      (advogado, assistente) → qpdf remove senha após upload

# PETITION ASSEMBLER
GET    /api/processes/:id/petition/preview       (advogado, assistente) → { summary, documents com rotation, videoLinks }
POST   /api/processes/:id/petition               (advogado, assistente) → gera PDF; type=requerimento|processo
POST   /api/processes/:id/summary                (advogado, assistente) → salva case_description + opcional sugestão Gemini

# PROCESSOS — adicional
PUT    /api/processes/:id/set-process-number     (advogado) → seta process_number → bloqueia edição pelo portal do cliente

# VIDEOS
POST   /api/videos/start-upload        (advogado, assistente, cliente) → { filename, fileSize, processId, mimeType, targetProvider }
POST   /api/videos/complete            (advogado, assistente, cliente) → { uploadId, itemId, provider, title } → retorna { publicLink }
GET    /api/processes/:id/videos       (advogado, assistente) → lista vídeos com links públicos
POST   /api/processes/:id/video-annex  (advogado) → gera PDF de relação de mídias com QR Code

# HEARINGS
GET    /api/hearings                   (advogado, assistente)
POST   /api/hearings                   (advogado, assistente)
PUT    /api/hearings/:id               (advogado, assistente)
DELETE /api/hearings/:id               (advogado)
GET    /api/hearings/calendar/:year/:month  (advogado, assistente)

# FINANCIAL
GET    /api/processes/:id/financial    (advogado)
POST   /api/processes/:id/financial    (advogado)
PUT    /api/financial/:id              (advogado)
GET    /api/financial/dashboard        (advogado)
POST   /api/financial/:id/installments (advogado)
PUT    /api/financial/installments/:id (advogado)

# WHATSAPP
GET    /api/whatsapp/status            (advogado)
POST   /api/whatsapp/connect           (advogado)
POST   /api/whatsapp/send-message      (advogado, assistente)
POST   /api/whatsapp/send-reminder     (advogado, assistente)
POST   /api/whatsapp/webhook           (público — Evolution API webhook)

# COURT NOTIFICATIONS (PJe/Eproc)
GET    /api/court-notifications             (advogado)
GET    /api/court-notifications/:processId  (advogado)
POST   /api/court-notifications/mark-read   (advogado)
GET    /api/monitored-domains               (advogado)
POST   /api/monitored-domains               (advogado)
DELETE /api/monitored-domains/:id           (advogado)

# DASHBOARD
GET    /api/dashboard                  (advogado, assistente)

# INTERNAL (n8n only — API key auth)
GET    /internal/hearings/pending-reminders
GET    /internal/processes/pending-deadlines
POST   /internal/court-notifications/ingest
GET    /internal/monitored-domains/all
```

---

## 9. INTERFACES ABSTRATAS DE PROVIDERS

### 9.1 Storage Provider (OneDrive + Google Drive)

```typescript
// services/storage/IStorageProvider.ts
export interface UploadSessionResult {
  uploadUrl: string       // URL para o frontend enviar os chunks
  uploadId: string        // ID interno para rastrear
  provider: 'onedrive' | 'googledrive'
}

export interface StoredFile {
  itemId: string          // ID do arquivo no provider
  publicLink: string      // link de compartilhamento público
  provider: 'onedrive' | 'googledrive'
  fileName: string
  fileSize: number
}

export interface StorageFolder {
  folderId: string
  folderUrl: string
  provider: 'onedrive' | 'googledrive'
}

export interface IStorageProvider {
  readonly providerName: 'onedrive' | 'googledrive'

  // Pastas
  createFolder(name: string, parentId?: string): Promise<StorageFolder>
  createFolderStructure(clientName: string, processNumber: string): Promise<{
    root: StorageFolder
    documentos: StorageFolder
    videos: StorageFolder
    pdfs: StorageFolder
  }>

  // Upload de arquivos (docs/PDFs)
  uploadFile(buffer: Buffer, fileName: string, folderId: string, mimeType: string): Promise<StoredFile>

  // Upload de vídeo em chunks (retorna URL para o frontend fazer o upload direto)
  createUploadSession(fileName: string, folderId: string, fileSize: number): Promise<UploadSessionResult>
  finalizeUpload(uploadId: string, itemId: string): Promise<StoredFile>

  // Compartilhamento
  createPublicLink(itemId: string): Promise<string>

  // Download (para unificação de PDF)
  downloadFile(itemId: string): Promise<Buffer>

  // Verificação
  checkConnection(userId: string): Promise<boolean>
}
```

```typescript
// services/StorageService.ts
// Orquestra um ou ambos os providers conforme user.storage_provider
export class StorageService {
  constructor(private userId: string) {}

  private async getProviders(): Promise<IStorageProvider[]> {
    const user = await prisma.user.findUnique({ where: { id: this.userId } })
    const pref = user?.storage_provider ?? 'onedrive'
    const providers: IStorageProvider[] = []
    if (pref === 'onedrive' || pref === 'ambos')
      providers.push(new OneDriveProvider(this.userId))
    if (pref === 'googledrive' || pref === 'ambos')
      providers.push(new GoogleDriveProvider(this.userId))
    return providers
  }

  // Quando "ambos": executa em paralelo, retorna resultados de ambos
  // Quando um só: retorna resultado desse provider
  async createFolderStructure(clientName: string, processNumber: string) {
    const providers = await this.getProviders()
    const results = await Promise.allSettled(
      providers.map(p => p.createFolderStructure(clientName, processNumber))
    )
    // Loga falhas mas não cancela — retorna o que conseguiu
    return results
  }

  async createPublicLink(oneDriveItemId?: string, googleDriveItemId?: string): Promise<{
    onedrive?: string
    googledrive?: string
  }> { /* ... */ }
}
```

---

### 9.2 Calendar Provider (Outlook + Google Calendar)

```typescript
// services/calendar/ICalendarProvider.ts
export interface CalendarEventInput {
  title: string
  description?: string
  startDateTime: Date
  endDateTime: Date
  location?: string
  attendeeEmails?: string[]
  reminderMinutes?: number
}

export interface CalendarEvent extends CalendarEventInput {
  eventId: string
  provider: 'outlook' | 'google'
  meetingUrl?: string   // Teams ou Google Meet
  htmlLink?: string     // link para abrir no calendário
}

export interface ICalendarProvider {
  readonly providerName: 'outlook' | 'google'

  createEvent(input: CalendarEventInput): Promise<CalendarEvent>
  updateEvent(eventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEvent>
  deleteEvent(eventId: string): Promise<void>
  listEvents(start: Date, end: Date): Promise<CalendarEvent[]>
  checkConnection(userId: string): Promise<boolean>
}
```

```typescript
// services/CalendarService.ts
// Quando "ambos": cria o evento nos dois calendários e salva ambos os IDs
// Hearing.outlook_event_id e Hearing.google_event_id ficam preenchidos
export class CalendarService {
  async createHearing(userId: string, input: CalendarEventInput): Promise<{
    outlookEventId?: string
    googleEventId?: string
    meetingUrl?: string
  }> { /* executa em paralelo nos providers ativos */ }

  // Para o FullCalendar: agrega eventos de ambos os providers em uma lista unificada
  async listEventsForCalendar(userId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
    /* merge e dedup por título+data para evitar duplicatas visuais quando "ambos" */
  }
}
```

---

### 9.3 WhatsApp Provider

```typescript
// services/providers/IWhatsAppProvider.ts
export interface MessageResult {
  messageId: string
  status: 'sent' | 'failed'
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  phone?: string
  instanceName?: string
}

export interface IWhatsAppProvider {
  sendText(to: string, text: string): Promise<MessageResult>
  sendDocument(to: string, buffer: Buffer, filename: string, caption?: string): Promise<MessageResult>
  getStatus(): Promise<ConnectionStatus>
  getQRCode(): Promise<string>
  disconnect(): Promise<void>
}
```

---

### 9.4 Rotas de autenticação OAuth — ambos providers

```
# Microsoft (OneDrive + Outlook)
GET  /auth/microsoft              → Redireciona para login Microsoft
GET  /auth/microsoft/callback     → Troca code por tokens, salva no banco
POST /auth/microsoft/refresh      → Renova access_token
POST /auth/microsoft/disconnect   → Remove tokens do banco

# Google (Drive + Calendar)
GET  /auth/google                 → Redireciona para login Google
GET  /auth/google/callback        → Troca code por tokens, salva no banco
POST /auth/google/refresh         → Renova access_token
POST /auth/google/disconnect      → Remove tokens do banco

# Status das conexões
GET  /api/settings/providers      → Retorna status de cada provider conectado
```

### 9.5 Tela de Configurações — seção "Provedores de Serviço"

O frontend exibe cards para cada provider com:
- Status (Conectado / Desconectado) com cor visual
- Botão "Conectar" (OAuth redirect) ou "Desconectar"
- Seletor de preferência: "Usar apenas este" / "Usar ambos"
- Espaço de armazenamento disponível (consultado via API do provider)

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ Microsoft OneDrive              │  │ Google Drive                    │
│ ● Conectado                     │  │ ○ Desconectado                  │
│ conta@outlook.com               │  │                                 │
│ 45,2 GB disponíveis             │  │ [Conectar com Google]           │
│ [Desconectar]  [◉ Usar ambos]   │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘

┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ Outlook Calendar                │  │ Google Calendar                 │
│ ● Conectado (via Microsoft)     │  │ ○ Desconectado                  │
│ [Desconectar]  [◉ Usar ambos]   │  │ [Conectar com Google]           │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 10. TEMPLATES DE MENSAGENS WHATSAPP

```
# Lembrete de audiência (D-3, D-2, D-1) — para CLIENTE
Olá {cliente_nome}!

Lembrete: você tem uma audiência em {dias} dia(s).

Data: {data_extenso}
Horário: {hora}
Local: {local}
Processo nº: {numero_processo}

Qualquer dúvida, entre em contato.
Dr(a). {advogado_nome} | OAB/{estado} {numero}

---

# Lembrete — para ADVOGADO
[JurisControl] Audiência em {dias} dia(s)
Cliente: {cliente_nome}
Processo: {numero_processo}
Data: {data} às {hora}
Local: {local}

---

# Notificação tribunal (urgente)
[URGENTE] Nova movimentação no processo {numero_processo}
Tipo: {tipo_movimentacao}
Prazo: {prazo_data} ({dias_restantes} dias)
Acesse o JurisControl para mais detalhes.

---

# Documento recebido
Olá {cliente_nome}! Recebemos seu documento: {nome_documento}.
Ele foi adicionado ao processo nº {numero_processo}.
Dr(a). {advogado_nome}

---

# Solicitação de documentos
Olá {cliente_nome}! Para continuidade do seu processo, precisamos dos seguintes documentos:
{lista_documentos}
Acesse o link para enviar: {link_intake}
Dr(a). {advogado_nome}

---

# Confirmação de pagamento
Olá {cliente_nome}! Confirmamos o recebimento de R$ {valor} em {data}.
Obrigado pela confiança!
Dr(a). {advogado_nome}

---

# Abertura do processo
Olá {cliente_nome}! Seu processo foi aberto.
Nº do processo: {numero_processo}
Status atual: {status}
Acompanhe pelo link: {link_portal_cliente}
Dr(a). {advogado_nome} | OAB/{estado} {numero}

---

# Resultado do processo
Olá {cliente_nome}! Seu processo teve um resultado.
Resultado: {tipo_desfecho}
{valor_acordo_se_aplicavel}
Dr(a). {advogado_nome} entrará em contato para os próximos passos.
```

---

## 11. FLUXO DE UPLOAD DE VÍDEO (SEM PASSAR PELO SERVIDOR)

O provider concreto é determinado por `user.storage_provider`. Quando "ambos", o upload ocorre no provider que o usuário escolher no momento (seletor na interface), e o link é salvo nos campos correspondentes.

```
1. Frontend → POST /api/videos/start-upload
   { filename, fileSize, processId, mimeType, targetProvider: 'onedrive'|'googledrive' }

2. Backend → StorageService.createUploadSession(...)
   → Se OneDrive: Graph API createUploadSession → retorna { uploadUrl }
   → Se Google Drive: Drive API resumable upload → retorna { uploadUrl }

3. Backend → salva upload pendente em cache com uploadId + provider

4. Frontend → PUT/POST {uploadUrl} em chunks de 5MB (Content-Range header)
   → Progresso exibido no componente VideoUploader

5. Frontend → POST /api/videos/complete { uploadId, itemId, provider }

6. Backend → StorageService.createPublicLink(itemId, provider)
   → OneDrive: anonymous + view link
   → Google Drive: anyone with link + viewer permission

7. Backend → salva em process_documents:
   onedrive_item_id / onedrive_share_link OU
   google_drive_item_id / google_drive_share_link
   (ou ambos se o advogado optar por publicar nos dois)

8. Backend → retorna { publicLink, provider, itemId }

Frontend exibe:
- Barra de progresso dos chunks
- Seletor de provider (se ambos conectados): "Publicar no OneDrive / Google Drive / Ambos"
- Botão "Copiar Link OneDrive" e/ou "Copiar Link Google Drive"
- Opção "Gerar PDF de Mídias" para petição
```

---

## 12. MONITORAMENTO PJe/EPROC VIA EMAIL (WORKFLOW N8N)

```
Arquivo: n8n/workflows/court-email-monitor.json

Trigger: Schedule (a cada 15 minutos)

Steps:
1. Busca lista de advogados com auto_monitor_court_emails=true
   → GET /internal/monitored-domains/all

2. Para cada advogado:
   → Chama Microsoft Graph API (Outlook)
   → GET /me/mailFolders/inbox/messages
   → Filtra: from.emailAddress.address CONTAINS domínios cadastrados
   → Filtra: isRead=false, receivedDateTime > última verificação

3. Para cada email encontrado:
   → Envia body do email para Gemini Flash com prompt:
     "Extraia do email: número do processo (formato TJRJ), tipo de movimentação,
      prazo se houver (data), urgência. Retorne JSON."
   → Gemini retorna: { processNumber, notificationType, deadline, isUrgent }

4. POST /internal/court-notifications/ingest
   { userId, emailSubject, emailBody, parsedData }

5. JurisControl:
   → Busca processo pelo número extraído
   → Cria CourtNotification
   → Se is_urgent=true: dispara WhatsApp imediato para advogado
   → Marca email como lido no Outlook

6. Marca email como lido via Graph API
```

---

## 13. BOT WHATSAPP — MÁQUINA DE ESTADOS

```
Estados por conversa (tabela whatsapp_sessions):
- idle
- aguardando_confirmacao
- menu_cliente
- menu_advogado

Palavras-chave e respostas:

CLIENTE:
  "detalhes" ou "meu processo"
    → Retorna: número, status, próxima audiência, resumo do advogado

  "documentos"
    → Retorna: lista de documentos recebidos + pendentes

  "audiência"
    → Retorna: data, horário, local da próxima audiência

  "ajuda"
    → Retorna: menu de opções disponíveis

ADVOGADO (identificado pelo número cadastrado):
  "detalhes [nome ou CPF]"
    → Retorna: ficha resumida do cliente + status do processo

  "recebido [valor]"
    → Registra pagamento + notifica cliente automaticamente

  "pendentes"
    → Retorna: lista de prazos e audiências dos próximos 7 dias

  "documentos [nome do cliente]"
    → Retorna: documentos pendentes do cliente

Webhook: POST /api/whatsapp/webhook
  → Identifica número
  → Verifica role (advogado ou cliente)
  → Roteia para handler correto
  → Atualiza whatsapp_sessions
  → Loga em whatsapp_messages
```

---

## 14. PDF DE RESUMO DO PROCESSO

Gerado com `pdf-lib`. Conteúdo:

```
[LOGO DO ESCRITÓRIO se cadastrado]
RESUMO DO PROCESSO JUDICIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: {nome}
CPF: {cpf mascarado}
Nº do Processo: {numero} (máscara TJRJ)
Tribunal: {tribunal} | Sistema: {pje/eproc}
Tipo: {tipo_processo}
Data de Abertura: {data}
Status: {status}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESCRIÇÃO DO CASO:
{descricao}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTOS ANEXADOS:
[lista com nome, tipo, data]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÍDIAS DIGITAIS:
[título — link clicável — data]
[Para mídia física: local de custódia]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIÊNCIAS:
[data — tipo — local — status]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINANCEIRO:
Valor da Causa: R$ {valor}
Honorários ({percentual}%): R$ {honorarios}
Status: {status_pagamento}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gerado em: {data_hora}
Dr(a). {nome_advogado} | OAB/{estado} {numero_oab}
JurisControl — Sistema de Gestão Jurídica
```

---

## 15. GEMINI — CASOS DE USO IMPLEMENTADOS

| Caso | Trigger | Prompt resumido | Saída |
|------|---------|-----------------|-------|
| Resumo do caso | Intake form preenchido | "Estruture em JSON: fatos, pedido, tipo de processo sugerido, documentos necessários" | Preenche process.ai_summary |
| Classificação de documento | Upload de imagem/PDF | "Identifique o tipo deste documento jurídico: {base64}" | Preenche document_type automaticamente |
| Parse de email tribunal | n8n court monitor | "Extraia do email: número processo, tipo movimentação, prazo, urgência. JSON." | CourtNotification.parsed_content |
| Resumo processo PDF | Botão "Gerar PDF" | "Redija em linguagem acessível para leigo o resumo deste caso: {dados}" | Seção do PDF de resumo |
| Bot WhatsApp inteligente | Mensagem não reconhecida | "Classifique a intenção desta mensagem de WhatsApp de {role}: {mensagem}" | Roteia para handler correto |

---

## 16. FASES DE DESENVOLVIMENTO

> **Instrução para o agente de IA:** A cada sessão, cole este arquivo COMPLETO + apenas o conteúdo da FASE que está desenvolvendo. Nunca processe mais de uma fase por sessão.

---

### FASE 0 — Setup e Infraestrutura
**Escopo:** Configuração inicial, banco, estrutura MVC, integração Veinx

**O que criar:**
- Inicializar backend: `npm init`, instalar dependências, configurar TypeScript strict
- Inicializar frontend: Vite + React + TypeScript, importar componentes do `/venix`
- `prisma/schema.prisma` completo (conforme Seção 4)
- `backend/src/app.ts` com Express configurado, CORS, helmet, body-parser
- `backend/src/config/database.ts` — Prisma client singleton
- `backend/src/middleware/errorHandler.ts` — middleware global de erro
- `.env.example` conforme Seção 5
- `docker-compose.yml` para n8n local
- Scripts npm: `dev`, `build`, `start`, `migrate`, `generate`
- `npx prisma migrate dev --name init`

**Critério de conclusão:** `npx prisma studio` mostra todas as tabelas. Backend sobe sem erro. Frontend exibe layout base do Veinx.

---

### FASE 1 — Autenticação e OAuth (Microsoft + Google)
**Escopo:** JWT, refresh token, RBAC, OAuth2 Microsoft, OAuth2 Google

**O que criar:**
- `auth.controller.ts` — login, refresh, logout
- `auth.routes.ts` — rotas auth + Microsoft OAuth + Google OAuth
- `middleware/auth.ts` — JWT verify
- `middleware/rbac.ts` — requireRole()
- `middleware/refreshMsToken.ts` — renova token Microsoft antes de chamadas
- `middleware/refreshGoogleToken.ts` — renova token Google antes de chamadas
- `services/MicrosoftGraphService.ts` — base Graph API
- `services/GoogleAPIService.ts` — base Google OAuth2 (usando `googleapis` npm)
- `config/google.ts` — OAuth2Client configurado
- Frontend: página Login, callbacks Microsoft e Google, hook `useAuth`
- Zustand store: `authStore` com campos para ambos os providers
- Página Configurações → seção "Provedores de Serviço" com status de conexão de cada um

**Critério de conclusão:** Login retorna tokens. OAuth Microsoft salva tokens Microsoft. OAuth Google salva tokens Google. Ambos os tokens são renovados automaticamente por middleware.

---

### FASE 2 — CRM de Clientes e Portal de Intake
**Escopo:** CRUD clientes, portal de intake, tokens de acesso único, LGPD, geração de procuração

**Dependências:**
```bash
npm install qrcode uuid
npm install --save-dev @types/uuid
```

---

#### Regras de negócio obrigatórias

**Geração da Procuração (regra crítica):**
A procuração só pode ser gerada quando os seguintes campos do cliente estiverem preenchidos:
`full_name`, `cpf` (válido), `rg` OU `cnh` (pelo menos um), `address`, `city`, `state`, `zip_code`.
Se algum campo faltar: backend retorna 422 com lista dos campos ausentes. Frontend desabilita o botão e exibe tooltip.

Campos recomendados (usados na procuração mas não bloqueiam geração):
`gender` (sem ele, procuração usa forma neutra "o/a Outorgante"), `profession`, `marital_status`, `social_name`.
O backend gera mesmo sem eles, mas a procuração fica menos precisa — frontend exibe aviso amarelo.

O PDF da procuração é sempre gerado em **formato A4**, sem proteção de senha, com linha de assinatura manual para o cliente imprimir, assinar à mão e reenviar digitalizado via intake.

**Unicidade de campos por escritório (não global):**
Os campos `cpf`, `rg`, `email` e `whatsapp` devem ser únicos por `user_id` (escritório).
Dois escritórios diferentes PODEM ter o mesmo CPF. A verificação é feita no controller antes de criar/atualizar.
Em caso de duplicata no create: retornar 409 com `client_id` do registro existente para o frontend redirecionar.
Em caso de duplicata no update: ignorar o próprio registro com `NOT: { id: req.params.id }`.

**Soft delete obrigatório:**
Nunca usar DELETE físico. Usar `update({ data: { deleted_at: new Date(), status: 'inativo' } })`.
Toda query de listagem e busca deve incluir `deleted_at: null`.

**Multi-tenant obrigatório:**
Todo `findFirst` / `findMany` / `findUnique` em clientes DEVE incluir `user_id: req.user.id`.

**Bloqueio de edição pelo portal do cliente:**
`process_number !== null` → cliente não pode mais editar dados pessoais nem documentos.
`summary_pdf_url !== null` → cliente não pode mais fazer upload de documentos.
Verificar esses campos no controller antes de processar qualquer edição vinda do portal.

---

#### O que criar no backend

- `clients.controller.ts` + `clients.routes.ts`
  - `list`: paginação (limit/page), busca por `full_name`, `cpf`, `email`; sempre `deleted_at: null`
  - `create`: valida unicidade (cpf, rg, email, whatsapp) por user_id antes de criar
  - `getOne`: inclui processos ativos/histórico + tokens de intake ativos
  - `update`: revalida unicidade excluindo o próprio registro
  - `delete`: soft delete — `deleted_at = now()` + `status = inativo`
  - `checkProcuracao`: verifica quais campos obrigatórios estão preenchidos para gerar procuração
  - `generateProcuracao`: valida campos → chama PDFService → retorna downloadUrl

- `intake.controller.ts` + `intake.routes.ts`
  - `generateToken`: cria IntakeToken (7 dias) + envia link por WhatsApp se cliente tiver número
  - `generateTokenNew`: `$transaction` — cria Client + Process (opcional) + IntakeToken
  - `getStatus`: verifica token (not found / expired / already used) → retorna dados do cliente
  - `getDocuments`: lista docs já enviados ao processo via token
  - `generateTempProcuracao`: gera PDF temporário com dados do body (antes do submit) para o cliente baixar
  - `submit`: `$transaction` — atualiza Client + cria Consent(s) LGPD + marca token `used_at` + gera procuração definitiva
  - `upload`: recebe arquivo via token; detecta PDF criptografado; retorna `{ requiresPassword: true }` se necessário

- `src/utils/cpf.ts` — `validarCPF(cpf: string): boolean` com algoritmo completo dos dígitos verificadores
- `src/utils/validators.ts` — máscaras e sanitização (CPF, CEP, WhatsApp: remover formatação antes de salvar)

---

#### O que criar no frontend

**Páginas (todas com classes Veinx — nunca Bootstrap do zero):**

`/clients` — `ClientList.tsx`
- Datatable com colunas: Nome, CPF (mascarado), Contato, Processos, Status, Cadastro, Ações
- Ações em ícones: `[👁 ri-eye-line]` ver ficha · `[✏ ri-pencil-line]` editar · `[🔗 ri-link]` gerar link intake
- Busca com debounce 300ms · Paginação · Filtro por status
- Botão "Novo Cliente" abre modal ou navega para `/clients/new`

`/clients/new` e `/clients/:id/edit` — `ClientForm.tsx`
- Máscara automática: CPF `000.000.000-00`, CEP (auto-fill ViaCEP), WhatsApp
- Validação em tempo real do CPF com `validarCPF()`
- Ao preencher CEP: `fetch https://viacep.com.br/ws/{cep}/json/` → preenche address, neighborhood, city, state
- Campo **Identidade de Gênero**: select com opções "Masculino", "Feminino", "Não-binário", "Outro"
  - Este campo controla a flexão de toda a procuração (artigos, adjetivos, estado civil)
- Campo **Nome Social** (opcional): quando preenchido, substitui o nome completo na procuração
  - Label: "Nome Social (opcional) — usado na procuração no lugar do nome de registro"
- Campo **Profissão**: text input livre (preenchido na procuração como "Profissão: ___")
- Campo **Estado Civil**: select com opções Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), União Estável
- Campo **Nacionalidade**: text input (default "Brasileiro" — flexionado automaticamente por gênero)
- Card lateral "Gerar Procuração" com checklist dos campos obrigatórios: verde ✓ / vermelho ✗
  - Checklist: full_name ✓ · cpf ✓ · rg ou cnh ✓ · address ✓ · city ✓ · state ✓ · zip_code ✓
  - Gênero e profissão aparecem como "recomendados" (⚠ amarelo) mas não bloqueiam a geração
- Botão "Gerar Procuração" habilitado apenas quando todos os campos OBRIGATÓRIOS estiverem ✓

`/clients/:id` — `ClientDetails.tsx`
- Dados pessoais em cards + badge de status
- Datatable de processos com abas **Ativos** / **Histórico**
  - Ativos: status IN `['aberto', 'em_andamento', 'aguardando_audiencia']`
  - Histórico: status IN `['encerrado', 'ganho', 'perdido', 'acordo', 'arquivado']`
  - Colunas: Título, Nº Processo, Status (badge colorido), Abertura, Ações
  - Ações: `[👁]` ver processo · `[📁]` abrir InternalIntakePage · `[📄]` abrir Montador de Petição
  - `[📁]` aparece apenas quando `process_number === null`
- Botão "Ativar Portal do Cliente" (Fase 13 — apenas placeholder nesta fase)
- Botão "Gerar Link de Intake" → modal com opções (novo caso / vincular processo existente)

`/intake/:token` — `IntakeForm.tsx` (layout SEM sidebar, SEM navbar do sistema)
- Seção 1: Dados pessoais (full_name, cpf, rg, birth_date, email, phone, whatsapp)
  - Campos adicionais: profession, marital_status (select), gender (select), social_name (opcional), nationality
  - Ao preencher todos obrigatórios: botão "Baixar Procuração" aparece → `POST /api/intake/:token/generate-temp-procuracao`
- Seção 2: Endereço (zip_code com auto-fill ViaCEP, address, number, complement, neighborhood, city, state)
- Seção 3: Documentos (só aparece quando `intakeToken.process_id` existe)
  - Upload com label por tipo: Procuração assinada · RG ou CNH · Comprovante de residência · Documentos do caso
  - Se PDF com senha: frontend exibe modal de senha ao receber `{ requiresPassword: true }`
  - Lista de arquivos já enviados atualizada em tempo real
- Seção 4: Resumo do caso (textarea — só com process_id)
- Seção 5: Consentimento LGPD — checkbox obrigatório
- Botão "Confirmar e Enviar" desabilitado até: CPF válido + LGPD aceito
- Após submit: tela de conclusão com botão "Baixar Procuração" da versão definitiva

`/clients/:id/intake` — `InternalIntakePage.tsx`
- Dropdown de seleção de processo (pré-selecionado via `?process=:processId`)
- Campo "Resumo do Caso" pré-preenchido com `case_description` do processo
- Upload de documentos com detecção automática de PDF criptografado
- Modal de senha quando `requiresPassword: true`
- Botão "Salvar Resumo" → `POST /api/processes/:id/summary`

---

#### Lógica dos dois tipos de token de intake

**Tipo 1 — Novo cliente** (`POST /api/intake/generate-new`):
Body: `{ name, whatsapp, phone?, case_title? }`
`$transaction`: cria `Client` + `Process` (se `case_title`) + `IntakeToken`
Cliente acessa link → preenche dados completos → sistema cria/atualiza Client + Consent + procuração

**Tipo 2 — Cliente existente** (`POST /api/intake/generate`):
Body: `{ client_id, process_id? }`
Cria apenas `IntakeToken` vinculado ao client_id (e process_id se informado)
Com `process_id`: formulário exibe seção de documentos
Sem `process_id`: formulário exibe apenas dados pessoais + opção de descrever novo caso

---

#### Critério de conclusão da Fase 2

1. Advogado cadastra cliente com CPF → campos obrigatórios completos → procuração disponível para gerar
2. CPF duplicado no mesmo escritório → 409 com `client_id` para redirecionar
3. Validação de campo único: rg, email, whatsapp duplicados → 409 com mensagem clara
4. Advogado gera link de intake → cliente acessa → preenche dados + vê procuração temporária + envia docs
5. PDF com senha no intake → modal de senha → senha correta → salvo sem senha
6. Submit do intake → `$transaction` → dados salvos + LGPD registrado + token `used_at` + procuração definitiva gerada
7. Acessar token já usado → 410 com mensagem "Este link já foi utilizado"
8. Acessar token expirado → 410 com mensagem "Este link expirou"
9. Datatable de clientes com busca (debounce), paginação e filtros funcionando
10. Aba Ativos / Histórico na ficha do cliente separando corretamente por status


---

### FASE 3 — Templates + PDF Engine + Montador de Petição
**Escopo:** CRUD templates, geração de PDF com Puppeteer, upload de documentos, rotação, unificação, Montador de Petição

**Biblioteca PDF: `puppeteer-core` + `@sparticuz/chromium`** para HTML→PDF. **`pdf-lib`** para mesclar/rotacionar PDFs existentes. **`sharp`** para otimizar imagens antes de embutir.
**Armazenamento nesta fase:** PDFs gerados → `/tmp/juriscontrol/pdfs/` → servidos via `/api/downloads/:filename`. Upload OneDrive/Drive na Fase 4.

**Dependências:**
```bash
npm install puppeteer-core @sparticuz/chromium pdf-lib sharp bcryptjs file-type
npm install --save-dev @types/bcryptjs
```

**Dependência de sistema (VPS):**
```bash
sudo apt-get install -y libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64   libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1   libasound2t64 qpdf
npx puppeteer browsers install chrome
```

---

#### Os dois PDFs gerados — distinção obrigatória

O Montador de Petição gera **dois PDFs completamente independentes**. Nunca fundidos automaticamente. O advogado os baixa separadamente e os anexa no PJe/Eproc um a um.

| PDF | Endpoint `type` | Conteúdo | Salva no banco? |
|-----|----------------|---------|----------------|
| `requerimento.pdf` | `type: 'requerimento'` | Texto do advogado (HTML rico) + links de vídeo na seção "Provas Digitais" | NÃO salva `summary_pdf_url` — não bloqueia edição do cliente |
| `processo.pdf` | `type: 'processo'` | Documentos unificados na ordem fixa + rotações aplicadas | SIM salva `summary_pdf_url` → bloqueia upload pelo portal do cliente |

---

#### Ordem fixa obrigatória no processo.pdf

```
1. procuracao          ← FIXO na posição 1 (não pode ser movido pelo drag-and-drop)
2. identidade / cnh    ← FIXO na posição 2 (qualquer um satisfaz — RG ou CNH)
3. comprovante_residencia ← FIXO na posição 3
4. [documentos do caso] ← VARIÁVEL — drag-and-drop só afeta este grupo
```

Esta ordem é hardcoded no `PDFService.generateProcessoPDF()`. O drag-and-drop só reordena documentos com `document_type NOT IN ['procuracao', 'identidade', 'cnh', 'comprovante_residencia']`.

---

#### conteúdo de `requerimento.pdf`

```
[LOGO DO ESCRITÓRIO — se configurado em Settings.office_logo_url]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUERIMENTO
Cliente: {client.full_name}
CPF: {cpf mascarado: 123.456.***-**}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{texto do advogado — HTML convertido pelo Puppeteer}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVAS DIGITAIS DISPONÍVEIS:          ← Seção só aparece se videoLinks.length > 0
1. {título}
   Link: {url}
   {descrição se houver}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{cidade}, {data por extenso}
Dr(a). {user.name} | OAB/{user.oab_state} {user.oab_number}
```

---

#### PDFService.ts — métodos obrigatórios

```typescript
// Gera requerimento.pdf (HTML → Puppeteer + seção de vídeos)
async generateRequerimento(params: {
  process: Process & { client: Client }
  user: User
  htmlContent: string
  videoLinks: Array<{ title: string; url: string; description?: string }>
  officeLogoUrl?: string
}): Promise<{ filePath: string; downloadUrl: string; fileHash: string }>

// Gera processo.pdf (ordem fixa: procuração→doc.pessoal→residência→caso + rotações)
async generateProcessoPDF(params: {
  processId: string
  documentIdsOrdem: string[]     // IDs dos docs da categoria 4, na ordem do drag-and-drop
  userId: string
}): Promise<{ filePath: string; downloadUrl: string; fileHash: string; pageCount: number }>

// Interno: converte imagem (Buffer) em página PDF A4 centralizada
private async imageToPdfPage(buffer: Buffer, rotation: number): Promise<PDFPage>

// Interno: aplica rotação em todas as páginas de um PDF existente
private async rotatePdfPages(pdfBytes: Uint8Array, rotation: number): Promise<Uint8Array>

// Gera PDF de procuração em formato A4 via template HTML (Puppeteer)
// Sempre com linha de assinatura manual. Sem proteção de senha.
// Usa gender/social_name do cliente para flexão correta do texto.
async generateProcuracao(
  client: Client & { user?: User },
  user: User
): Promise<{ filePath: string; downloadUrl: string; fileHash: string }>

// Detecta se PDF está criptografado (sem abrir com senha)
async isPdfEncrypted(buffer: Buffer): Promise<boolean>
// Implementação: tenta PDFDocument.load(buffer) — exceção = criptografado

// Remove senha via qpdf (ferramenta de sistema)
async unlockPdfWithQpdf(inputPath: string, password: string): Promise<string>
// Retorna outputPath do arquivo desbloqueado
// Lança: WRONG_PASSWORD | QPDF_NOT_AVAILABLE | QPDF_FAILED

// Gera PDF de relação de mídias digitais com QR Code
async generateVideoAnnex(processId: string, documentIds: string[], userId: string): Promise<{ filePath: string }>

// Cron job de limpeza (a cada 30min): remove arquivos em PDF_DIR com mais de 1 hora
// Adicionar em jobs/cleanupJob.ts
```

---

#### Tipos de arquivo aceitos e detecção real de MIME

O sistema aceita PDFs e imagens fotográficas (JPG, PNG, WEBP, HEIC). A detecção do tipo real é feita pelos primeiros bytes do arquivo (magic bytes), **nunca pela extensão** — um arquivo `.pdf` renomeado de `.jpg` não engana o sistema.

```typescript
// src/utils/mimeDetect.ts
import { fileTypeFromBuffer } from 'file-type'

type AcceptedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'

const ALLOWED_MIMES: AcceptedMime[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]

export async function detectMime(buffer: Buffer): Promise<AcceptedMime> {
  const result = await fileTypeFromBuffer(buffer)
  if (!result || !ALLOWED_MIMES.includes(result.mime as AcceptedMime)) {
    throw new Error(`Tipo de arquivo não suportado: ${result?.mime ?? 'desconhecido'}. Use PDF, JPG, PNG ou WEBP.`)
  }
  return result.mime as AcceptedMime
}
```

```bash
npm install file-type
```

---

#### Fluxo de upload de documento (DocumentsController)

```
Arquivo recebido via Multer (campo 'file')
  │
  ├─ 1. Detectar MIME real pelos magic bytes (não pela extensão)
  │     → Se tipo não permitido → 422 "Tipo de arquivo não suportado"
  │
  ├─ 2. É IMAGEM (jpeg | png | webp | heic)?
  │     → Otimizar com sharp:
  │         .rotate()           ← CRÍTICO: corrige EXIF orientation automaticamente
  │                               (foto tirada na vertical pelo celular → aparece correta)
  │         .resize({ width: 2480, height: 3508, fit: 'inside' })  ← A4 @ 210dpi, sem upscale
  │         .jpeg({ quality: 85 })
  │     → Salvar buffer otimizado
  │     → rotation = 0 no banco (sharp já corrigiu o EXIF)
  │     → Retornar { requiresPassword: false }
  │
  └─ 3. É PDF?
       ├─ Detectar criptografia: PDFDocument.load(buffer) — exceção = criptografado
       ├─ Não criptografado → salvar normalmente
       └─ Criptografado
            ├─ Sem 'password' no body → deletar temp → retornar { requiresPassword: true }
            │   Frontend: abre modal "Informe a senha do PDF"
            ├─ Com password + qpdf disponível
            │   ├─ Senha correta → salvar arquivo desbloqueado, requires_password=false
            │   └─ Senha errada → retornar { requiresPassword: true, error: 'Senha incorreta' }
            └─ qpdf indisponível → salvar criptografado, requires_password=true, logar aviso

Após salvar qualquer arquivo:
  → Calcular SHA-256 (integridade): file_hash
  → Salvar file_mime no banco (para lógica de conversão posterior)
  → Registrar em ProcessTimeline: "Documento adicionado: {nome} ({tipo})"

Verificação de bloqueio ANTES do upload:
  → Se process.process_number !== null E requisição vem de portal do cliente: 403
  → Se summary_pdf_url !== null E requisição vem de portal do cliente: 403
  → Advogado sempre pode fazer upload independente do estado
```

---

#### Rotação individual — regras obrigatórias

**O campo `rotation` no banco é non-destructive** — o arquivo original NUNCA é modificado.
A rotação é aplicada somente na geração do `processo.pdf` final.

```typescript
// Comportamento do botão [↻] no frontend:
// Cada clique avança: 0 → 90 → 180 → 270 → 0
// Preview visual: CSS transform: rotate(${rotation}deg)
// Chamada API com debounce 500ms: PUT /api/processes/:id/documents/:docId/rotate

// No PDFService.generateProcessoPDF, ao processar cada documento:

async function processarArquivoParaPDF(doc: ProcessDocument): Promise<PDFPage[]> {
  const buffer = await lerArquivoLocal(doc.file_path)   // ou download do storage
  const mime = doc.file_mime

  if (mime === 'application/pdf') {
    const pdfDoc = await PDFDocument.load(buffer)
    // Aplicar rotação em todas as páginas do PDF
    if (doc.rotation !== 0) {
      pdfDoc.getPages().forEach(page => {
        const rotacaoAtual = page.getRotation().angle
        page.setRotation(degrees((rotacaoAtual + doc.rotation) % 360))
      })
    }
    return pdfDoc.getPages()   // retornar páginas para copiar no PDF final

  } else {
    // Imagem: converter para página A4 centralizada
    let imgBuffer = buffer
    // Aplicar rotação adicional do usuário SOBRE a rotação EXIF já corrigida pelo sharp no upload
    if (doc.rotation !== 0) {
      imgBuffer = await sharp(buffer)
        .rotate(doc.rotation)   // rotação explícita (não EXIF)
        .toBuffer()
    }
    // Embutir no PDF como página A4 com a imagem centralizada
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89])  // A4 em pontos
    const isLandscape = doc.rotation === 90 || doc.rotation === 270

    let img: PDFImage
    if (mime === 'image/jpeg' || mime === 'image/heic') {
      img = await pdfDoc.embedJpg(imgBuffer)
    } else {
      img = await pdfDoc.embedPng(imgBuffer)
    }

    const { width: pageW, height: pageH } = page.getSize()
    const maxW = pageW - 40
    const maxH = pageH - 40
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    page.drawImage(img, {
      x: (pageW - img.width * scale) / 2,
      y: (pageH - img.height * scale) / 2,
      width: img.width * scale,
      height: img.height * scale,
    })
    return page
  }
}
```

---

#### Reordenação de documentos — regras e implementação

```typescript
// PUT /api/processes/:id/documents/reorder
// Body: { documentIds: string[] }  ← IDs apenas da categoria 4 (docs do caso)

// VALIDAÇÃO obrigatória no controller:
// 1. Verificar que todos os IDs pertencem ao processo E ao user (multi-tenant)
// 2. Filtrar: aceitar APENAS documentos com document_type NOT IN
//    ['procuracao', 'identidade', 'cnh', 'comprovante_residencia']
// 3. Se o cliente enviar IDs de categorias fixas → ignorar silenciosamente (não retornar erro)
// 4. Atualizar order_index em $transaction para garantir consistência

async reorder(req, res, next) {
  const { documentIds } = req.body as { documentIds: string[] }

  // Buscar documentos válidos (só categoria 4, só deste processo e deste user)
  const CATEGORIAS_FIXAS = ['procuracao', 'identidade', 'cnh', 'comprovante_residencia']
  const docsValidos = await prisma.processDocument.findMany({
    where: {
      id: { in: documentIds },
      process: { id: req.params.id, user_id: req.user.id },
      document_type: { notIn: CATEGORIAS_FIXAS },
      deleted_at: null,
    },
    select: { id: true }
  })

  const idsValidos = new Set(docsValidos.map(d => d.id))

  // Atualizar order_index mantendo a ordem enviada
  await prisma.$transaction(
    documentIds
      .filter(id => idsValidos.has(id))
      .map((id, index) =>
        prisma.processDocument.update({
          where: { id },
          data: { order_index: index + 10 }  // +10 para as categorias 1-3 ficarem em 1,2,3
        })
      )
  )

  return res.json({ message: 'Ordem atualizada' })
}
```

**Order_index reservados:**
```
order_index 1  → procuracao          (sempre primeiro)
order_index 2  → identidade ou cnh   (sempre segundo)
order_index 3  → comprovante_residencia (sempre terceiro)
order_index 10+ → documentos do caso (reordenáveis)
```

---

#### DocumentsController — métodos

- `list`: retorna docs do processo com `rotation`, `document_type`, `requires_password`, `file_url`, `file_mime`, `order_index`; ordenar por `order_index ASC`
- `upload`: fluxo acima; suporte a JPG, PNG, WEBP, HEIC, PDF (máx 50MB); detecção de MIME por magic bytes
- `rotate`: `PUT /:docId/rotate` — body `{ rotation: 0|90|180|270 }` — non-destructive, atualiza campo no banco
- `reorder`: `PUT /reorder` — só reordena categoria 4; categorias fixas ignoradas silenciosamente
- `delete`: soft delete via `deleted_at`
- `unlock`: `POST /:docId/unlock` — body `{ password }` — qpdf remove senha → sobrescreve arquivo → atualiza `file_hash` e `requires_password=false`

---

#### PetitionAssemblerController — roteamento

```typescript
// POST /api/processes/:id/petition
// Body: { type: 'requerimento' | 'processo', htmlContent?, videoLinks?, documentIds? }

if (body.type === 'requerimento') {
  const result = await pdfService.generateRequerimento({
    process, user, htmlContent: body.htmlContent, videoLinks: body.videoLinks ?? []
  })
  // NÃO atualiza summary_pdf_url — requerimento não bloqueia edição do cliente
  return res.json({ downloadUrl: result.downloadUrl })
}

if (body.type === 'processo') {
  const result = await pdfService.generateProcessoPDF({
    processId: process.id, documentIdsOrdem: body.documentIds ?? [], userId: req.user.id
  })
  // ATUALIZA summary_pdf_url → bloqueia novos uploads pelo portal do cliente
  await prisma.process.update({
    where: { id: process.id },
    data: { summary_pdf_url: result.downloadUrl }
  })
  // Registrar na timeline
  await prisma.processTimeline.create({
    data: {
      process_id: process.id, user_id: req.user.id,
      action_type: 'processo_pdf_gerado',
      description: `PDF do processo gerado (${result.pageCount} páginas)`
    }
  })
  return res.json({ downloadUrl: result.downloadUrl, pageCount: result.pageCount })
}
```

---

#### O que criar no frontend

**`/processes/:id/petition` — `PetitionAssembler.tsx`**

Layout em dois painéis Bootstrap (`col-lg-6` cada):

**Painel esquerdo — Requerimento:**
- Editor de texto rico (contentEditable + toolbar: B, I, U, listas, alinhamento)
- Texto pré-carregado de `case_description` via `GET /api/processes/:id/petition/preview`
- Seção "Links de Vídeo" — lista dinâmica:
  - Botão "+ Adicionar link de vídeo"
  - Cada item: campo Título + campo URL + botão Remover
  - Esses links vão no body ao gerar requerimento.pdf
- Botão **"⬇ Baixar requerimento.pdf"** → `POST /api/processes/:id/petition { type: 'requerimento', htmlContent, videoLinks }`
- Link de download aparece após geração bem-sucedida
- Loading state independente

**Painel direito — Documentação:**
- `DocumentChecklist`: aviso visual (não bloqueio) se faltam procuração / doc.pessoal / residência
  ```
  ⚠ Documentos pendentes:
    • Procuração não encontrada
    • RG ou CNH não encontrado
  [Inserir Documentos] → navega para InternalIntakePage
  ```
- Organizador drag-and-drop (`@dnd-kit/core`) com os documentos da categoria 4
  - Documentos das categorias 1-2-3 exibidos fixos no topo (não arrastáveis)
  - Cada card de documento: nome, tipo, thumbnail/ícone, botão `[↻]` de rotação
  - Botão `[↻]`: cicla `0° → 90° → 180° → 270° → 0°`; atualiza preview via CSS `transform: rotate(Xdeg)`; chama `PUT /:docId/rotate` com debounce 500ms
- Botão **"⬇ Baixar processo.pdf"** → `POST /api/processes/:id/petition { type: 'processo', documentIds }`
- Link de download aparece após geração bem-sucedida
- Loading state independente

---

#### Detecção de gênero e nome social — `src/utils/gender.ts`

O sistema detecta automaticamente o gênero para flexionar a procuração corretamente.
O campo `gender` do cliente controla toda a flexão. O campo `social_name` substitui `full_name` na procuração quando preenchido.

```typescript
// src/utils/gender.ts

export type Gender = 'M' | 'F' | 'NB' | 'outro'

interface GenderTerms {
  outorgante:    string  // "o Outorgante" | "a Outorgante"
  nacionalidade: string  // "brasileiro" | "brasileira" | "brasileiro(a)"
  estadoCivil:   string  // flexionado conforme marital_status + gender
  dr:            string  // "Dr." | "Dra." | "Dr(a)."
  artigo:        string  // "o" | "a" | "o(a)"
}

export function resolveGenderTerms(gender: Gender | null | undefined): GenderTerms {
  switch (gender) {
    case 'M':
      return {
        outorgante:    'o Outorgante',
        nacionalidade: 'brasileiro',
        estadoCivil:   '',        // preenchido por resolveMaritalStatus()
        dr:            'Dr.',
        artigo:        'o',
      }
    case 'F':
      return {
        outorgante:    'a Outorgante',
        nacionalidade: 'brasileira',
        estadoCivil:   '',
        dr:            'Dra.',
        artigo:        'a',
      }
    case 'NB':
    case 'outro':
    default:
      return {
        outorgante:    'o/a Outorgante',
        nacionalidade: 'brasileiro(a)',
        estadoCivil:   '',
        dr:            'Dr(a).',
        artigo:        'o/a',
      }
  }
}

export function resolveMaritalStatus(
  maritalStatus: string | null | undefined,
  gender: Gender | null | undefined
): string {
  const isFeminine = gender === 'F'
  const map: Record<string, [string, string]> = {
    // [masculino, feminino]
    'solteiro':        ['solteiro',       'solteira'],
    'casado':          ['casado',         'casada'],
    'divorciado':      ['divorciado',     'divorciada'],
    'viuvo':           ['viúvo',          'viúva'],
    'uniao_estavel':   ['em união estável', 'em união estável'],
  }
  const key = (maritalStatus ?? '').toLowerCase().replace(/[^a-z]/g, '')
  const found = map[key]
  if (!found) return maritalStatus ?? ''
  return isFeminine ? found[1] : found[0]
}

export function resolveNationality(
  nationality: string | null | undefined,
  gender: Gender | null | undefined
): string {
  // Flexiona a nacionalidade automaticamente para feminino
  // Regra: -o → -a (brasileiro→brasileira), -ês → -esa (francês→francesa)
  // Nacionalidades que não mudam: belga, israelense, etc.
  const nat = (nationality ?? 'Brasileiro').trim()
  if (gender !== 'F') return nat

  const feminineMap: Record<string, string> = {
    'Brasileiro':   'Brasileira',
    'Argentino':    'Argentina',
    'Americano':    'Americana',
    'Italiano':     'Italiana',
    'Português':    'Portuguesa',
    'Francês':      'Francesa',
    'Espanhol':     'Espanhola',
    'Alemão':       'Alemã',
    'Japonês':      'Japonesa',
    'Chinês':       'Chinesa',
    'Colombiano':   'Colombiana',
    'Chileno':      'Chilena',
    'Peruano':      'Peruana',
    'Mexicano':     'Mexicana',
    'Uruguaio':     'Uruguaia',
    'Paraguaio':    'Paraguaia',
    'Boliviano':    'Boliviana',
    'Venezuelano':  'Venezuelana',
  }
  return feminineMap[nat] ?? nat  // fallback: retornar como está
}

// Nome a usar na procuração — nome social prevalece quando preenchido
export function resolveDisplayName(client: {
  full_name: string
  social_name?: string | null
}): string {
  return client.social_name?.trim() || client.full_name
}
```

---

#### Template HTML da Procuração — baseado no modelo real do escritório

O PDF é gerado em **formato A4** via Puppeteer (HTML → PDF). Sem proteção de senha. Sem modos de assinatura configuráveis — o sistema sempre gera com linha de assinatura manual para o cliente imprimir, assinar e reenviar.

```typescript
// src/services/PDFService.ts — método generateProcuracao

async generateProcuracao(
  client: Client & { user: User },
  user: User
): Promise<{ filePath: string; downloadUrl: string; fileHash: string }> {

  const gender = resolveGenderTerms(client.gender as Gender)
  const maritalStatus = resolveMaritalStatus(client.marital_status, client.gender as Gender)
  const nationality = resolveNationality(client.nationality, client.gender as Gender)
  const displayName = resolveDisplayName(client)
  const hoje = new Date()
  const dia = hoje.getDate().toString()
  const mes = hoje.toLocaleDateString('pt-BR', { month: 'long' })
  const ano = hoje.getFullYear().toString()
  const cpfFormatado = client.cpf
    ? client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : ''
  const cepFormatado = client.zip_code
    ? client.zip_code.replace(/(\d{5})(\d{3})/, '$1-$2')
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2.5cm 3cm 3cm 3cm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    margin: 0; padding: 0;
  }
  .cabecalho {
    text-align: center;
    margin-bottom: 8px;
  }
  .cabecalho .nome-escritorio {
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .cabecalho .subtitulo {
    font-size: 11pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }
  .divider-top {
    border-top: 2px solid #000;
    margin: 12px 0 4px 0;
  }
  .titulo-procuracao {
    text-align: center;
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 8px;
    text-decoration: underline;
    margin: 18px 0 20px 0;
    text-transform: uppercase;
  }
  .bloco {
    border: 1.5px solid #000;
    padding: 10px 14px;
    margin-bottom: 12px;
  }
  .bloco p {
    margin: 4px 0;
    text-align: justify;
  }
  .label {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 11pt;
  }
  .linha-campo {
    display: inline;
    border-bottom: 1px solid #000;
    min-width: 120px;
  }
  .bloco-poderes {
    border: 1.5px solid #000;
    padding: 12px 14px;
    margin-bottom: 28px;
    text-align: justify;
  }
  .assinatura-area {
    margin-top: 40px;
    text-align: center;
  }
  .assinatura-linha {
    border-top: 1.5px solid #000;
    width: 60%;
    margin: 0 auto 6px auto;
  }
  .assinatura-nome {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
  }
  .assinatura-label {
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }
  .rodape {
    position: fixed;
    bottom: 1.5cm;
    left: 3cm;
    right: 3cm;
    text-align: center;
    font-size: 9pt;
    border-top: 1px solid #888;
    padding-top: 6px;
    color: #333;
  }
</style>
</head>
<body>

<div class="cabecalho">
  ${user.settings?.office_logo_url
    ? `<img src="${user.settings.office_logo_url}" style="height:50px;margin-bottom:8px;" /><br/>`
    : ''}
  <div class="nome-escritorio">${user.settings?.office_name ?? user.name}</div>
  <div class="subtitulo">Consultoria Jurídica</div>
</div>

<div class="divider-top"></div>

<div class="titulo-procuracao">P R O C U R A Ç Ã O</div>

<!-- BLOCO OUTORGANTE -->
<div class="bloco">
  <p>
    <span class="label">Outorgante:</span>
    <span class="linha-campo">&nbsp;${displayName}&nbsp;</span>
  </p>
  <p>
    <span class="label">Nacionalidade:</span>
    <span class="linha-campo">&nbsp;${nationality}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Estado Civil:</span>
    <span class="linha-campo">&nbsp;${maritalStatus}&nbsp;</span>
  </p>
  <p>
    <span class="label">Profissão:</span>
    <span class="linha-campo">&nbsp;${client.profession ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Identidade:</span>
    <span class="linha-campo">&nbsp;${client.rg ?? ''}&nbsp;</span>
  </p>
  <p>
    <span class="label">CPF</span>
    <span class="linha-campo">&nbsp;${cpfFormatado}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Endereço:</span>
    <span class="linha-campo">&nbsp;${client.address ?? ''}&nbsp;</span>
  </p>
  <p>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    <span class="label">N°</span>
    <span class="linha-campo">&nbsp;${client.address_number ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Bairro</span>
    <span class="linha-campo">&nbsp;${client.neighborhood ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Município/</span>
  </p>
  <p>
    <span class="label">Cidade</span>
    <span class="linha-campo">&nbsp;${client.city ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Estado</span>
    <span class="linha-campo">&nbsp;${client.state ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">CEP</span>
    <span class="linha-campo">&nbsp;${cepFormatado}&nbsp;</span>
  </p>
</div>

<!-- BLOCO OUTORGADO (advogado) -->
<div class="bloco">
  <p>
    <span class="label">Outorgado:</span>
    ${gender.dr} <strong>${user.name.toUpperCase()}</strong>,
    ${resolveNationality('Brasileiro', user.gender as Gender ?? 'M')},
    ${resolveMaritalStatus(user.marital_status, user.gender as Gender ?? 'M')},
    advogado${user.gender === 'F' ? 'a' : ''},
    inscrição na OAB/${user.oab_state} n.°${user.oab_number},
    com endereço profissional na
    ${user.settings?.office_address ?? 'endereço do escritório'} –
    com endereço virtual ${user.email}.
  </p>
</div>

<!-- BLOCO PODERES -->
<div class="bloco-poderes">
  <p>
    <span class="label">Poderes:</span>
    da Cláusula <strong>AD JUDICIA</strong>, para o foro em geral, em qualquer
    instância, Juízo ou Tribunal, nas esferas Federal, Estadual e Municipal,
    podendo propor, contestar, variar ou desistir de ações, e os poderes
    especiais para acordar, transigir, firmar compromissos, dar e receber
    alvarás para levantamento de depósitos judiciais, endossar, receber e dar
    quitação, processar, pedir a gratuidade de justiça e assinar declaração de
    hipossuficiência econômica. (em conformidade com a norma instituída pelo
    artigo 105 do CPC/2015), enfim todos os demais atos necessários ao bom
    desempenho deste mandato inclusive substabelecer com ou sem reservas de
    poderes.
  </p>
</div>

<!-- DATA E ASSINATURA -->
<p style="margin-left: 40px;">
  ${client.city ?? 'Rio de Janeiro'},
  <span style="border-bottom:1px solid #000">&nbsp;&nbsp;&nbsp;${dia}&nbsp;&nbsp;&nbsp;</span>
  de
  <span style="border-bottom:1px solid #000">&nbsp;&nbsp;&nbsp;${mes}&nbsp;&nbsp;&nbsp;</span>
  de ${ano}.
</p>

<div class="assinatura-area">
  <div class="assinatura-linha"></div>
  <div class="assinatura-nome">${displayName}</div>
  <div class="assinatura-label">Outorgante</div>
</div>

<!-- RODAPÉ DO ESCRITÓRIO -->
<div class="rodape">
  ${user.settings?.office_address ?? ''}
  ${user.email ? '&nbsp;|&nbsp;e-mail: ' + user.email : ''}
  ${user.phone ? '&nbsp;|&nbsp;' + user.phone : ''}
</div>

</body>
</html>`

  return this.htmlToPdf(html, `procuracao_${client.id}_${Date.now()}`)
}
```

**Nota importante:** o campo `marital_status` e `gender` também precisam estar no model `User` para que a procuração do advogado (outorgado) seja gerada com gênero correto. Adicionar esses campos ao model `User` na migration desta fase:
```prisma
// Adicionar ao model User:
gender          String?   // "M" | "F" | "NB" | "outro"
marital_status  String?   // "solteiro" | "casado" | etc.
```

---

#### Motor de variáveis para templates HTML customizados

```
{{nome}}              → resolveDisplayName(client)  — nome social prevalece
{{nome_completo}}     → client.full_name            — sempre o nome completo cadastrado
{{cpf}}               → CPF mascarado: 123.456.***-**
{{rg}}                → client.rg
{{profissao}}         → client.profession
{{nacionalidade}}     → resolveNationality(client.nationality, client.gender)
{{estado_civil}}      → resolveMaritalStatus(client.marital_status, client.gender)
{{outorgante_artigo}} → resolveGenderTerms(client.gender).outorgante
{{endereco}}          → client.address + ', ' + client.address_number
{{complemento}}       → client.complement
{{bairro}}            → client.neighborhood
{{cidade}}            → client.city
{{estado}}            → client.state
{{cep}}               → client.zip_code formatado (00000-000)
{{data_hoje}}         → new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })
{{advogado_nome}}     → user.name
{{advogado_dr}}       → resolveGenderTerms(user.gender).dr  — "Dr." | "Dra."
{{oab}}               → user.oab_number + '/' + user.oab_state
{{numero_processo}}   → process.process_number ?? 'A definir'
{{escritorio}}        → user.settings?.office_name ?? user.name
```

---

#### Campos em ProcessDocument (migration Fase 3)

```prisma
// Estes campos JÁ estão no schema da Seção 4 — confirmar que a migration foi gerada:
rotation          Int      @default(0)   // 0 | 90 | 180 | 270 — rotação individual, non-destructive
file_password     String?
requires_password Boolean  @default(false)
signature_status  String?  // "pending" | "signed" — para rastreamento se procuração foi assinada
```

---

#### ⚠️ Problema conhecido — Puppeteer no VPS

`puppeteer-core` + `@sparticuz/chromium` podem falhar silenciosamente se as dependências de sistema estiverem faltando. Sintoma: download retorna arquivo `.htm` em vez de `.pdf`. Verificar que `NODE_ENV=production` está definido e que `npx puppeteer browsers install chrome` foi executado.

---

#### Critério de conclusão da Fase 3

1. Advogado acessa Montador de Petição → campo pré-carregado com resumo do cliente
2. Adiciona 2 links de vídeo manualmente → gera `requerimento.pdf` → PDF contém texto + seção "Provas Digitais"
3. Faz upload de PDF com senha → modal de senha → senha correta → arquivo salvo sem senha
4. Clica `[↻]` em documento → preview rotaciona visualmente (CSS) → `PUT /rotate` chamado
5. Gera `processo.pdf` → documentos na ordem fixa (procuração→doc.pessoal→residência→caso) + rotações aplicadas
6. Após gerar `processo.pdf` → `summary_pdf_url` salvo → portal do cliente bloqueia novos uploads
7. Os dois PDFs são completamente independentes e baixados separadamente
8. Drag-and-drop: categorias 1-2-3 são fixas no topo, apenas categoria 4 pode ser reordenada


### FASE 4 — Gestão de Processos e Storage (OneDrive + Google Drive)
**Escopo:** CRUD processos, criação automática de pasta em ambos os providers, timeline

**O que criar:**
- `processes.controller.ts` + `processes.routes.ts`
- `services/storage/IStorageProvider.ts` — interface completa (conforme Seção 9.1)
- `services/storage/OneDriveProvider.ts` — implementação OneDrive
- `services/storage/GoogleDriveProvider.ts` — implementação Google Drive
- `services/StorageService.ts` — orquestrador conforme `user.storage_provider`
- Criação automática de pastas ao criar processo nos providers ativos:
  `JurisControl/{NomeCliente}/{NumeroProcesso}/Documentos/`, `/Videos/`, `/PDFs/`
- Salvar `onedrive_folder_id` e/ou `google_drive_folder_id` no processo
- `ProcessTimeline` — registrar toda ação relevante automaticamente
- Máscara de número de processo TJRJ: `NNNNNNN-DD.AAAA.J.TT.OOOO`
- Frontend: listagem processos, ficha do processo completa, linha do tempo, badge mostrando em quais providers o processo tem pasta

**Critério de conclusão:** Processo criado com OneDrive+Google configurados → pastas criadas em ambos → timeline registra a criação → ficha exibe links de ambos os storages.

---

### FASE 5 — Gestão de Documentos e Unificador PDF
**Escopo:** Upload de documentos, reordenação drag-and-drop, PDF unificado

**O que criar:**
- `documents.controller.ts` + `documents.routes.ts`
- Upload para OneDrive (imagens e PDFs) — via Graph API upload session
- Suporte: JPG, PNG, WEBP, PDF
- `PDFService.unifyDocuments(documentIds, outputName)`:
  - Baixa arquivos do OneDrive
  - Imagens → converte para página PDF (sharp → pdf-lib)
  - PDFs → adiciona páginas em ordem
  - Faz upload do PDF unificado para pasta `/PDFs/` do processo
  - Retorna link público
- Interface drag-and-drop para ordenar documentos antes de unificar (`@dnd-kit/core`)
- Frontend: galeria de documentos com preview, reordenação, botão "Unificar PDF"

**Critério de conclusão:** Upload de 3 imagens + 1 PDF → arrastar para ordenar → clicar "Unificar" → PDF com 4 páginas na ordem correta disponível no OneDrive.

---

### FASE 6 — Vídeos e PDF de Mídias
**Escopo:** Upload direto OneDrive, registro de mídia física, PDF de relação de mídias

**O que criar:**
- `videos.controller.ts` + `videos.routes.ts`
- `POST /api/videos/start-upload` → cria uploadSession no OneDrive → retorna uploadUrl
- `POST /api/videos/complete` → cria link de compartilhamento → salva no banco
- Frontend: componente VideoUploader com barra de progresso por chunks (5MB)
- Botão "Copiar Link" após upload
- Formulário para registrar mídia física (local de custódia, data, descrição)
- `PDFService.generateVideoAnnex(processId, documentIds)` — gera "Relação de Mídias Digitais" com: título, descrição, data, link clicável, QR Code, hash SHA-256
- Upload do PDF de mídias para OneDrive `/PDFs/`
- Frontend: página de vídeos do processo, botão "Gerar PDF de Mídias para Petição"

**Critério de conclusão:** Vídeo de 500MB enviado direto ao OneDrive → link público gerado → PDF de relação gerado com QR Code → PDF disponível no OneDrive.

---

### FASE 7 — WhatsApp Bot
**Escopo:** Integração Evolution API, webhook, máquina de estados, templates automáticos

**O que criar:**
- `services/providers/IWhatsAppProvider.ts` — interface
- `services/providers/EvolutionAPIProvider.ts` — implementação
- `services/WhatsAppService.ts` — usa o provider via env WHATSAPP_PROVIDER
- `whatsapp.controller.ts` + `whatsapp.routes.ts`
- `POST /api/whatsapp/webhook` — recebe mensagens, identifica role, roteia
- Máquina de estados em `WhatsAppSession` conforme Seção 13
- Todos os templates da Seção 10 implementados como funções tipadas
- Envio automático ao gerar link de intake
- Frontend: página de configuração WhatsApp com QR Code, status, histórico de mensagens

**Critério de conclusão:** Número conectado → cliente digita "detalhes" → bot responde com resumo do processo → advogado digita "pendentes" → bot lista audiências da semana.

---

### FASE 8 — Calendário, Audiências e Calendários Externos
**Escopo:** CRUD audiências, integração Outlook Calendar + Google Calendar, notificações D-3/D-2/D-1

**O que criar:**
- `hearings.controller.ts` + `hearings.routes.ts`
- `services/calendar/ICalendarProvider.ts` — interface completa (conforme Seção 9.2)
- `services/calendar/OutlookCalendarProvider.ts` — implementação Outlook
- `services/calendar/GoogleCalendarProvider.ts` — implementação Google Calendar (usando `googleapis`)
- `services/CalendarService.ts` — orquestrador conforme `user.calendar_provider`
- Ao criar audiência: cria evento nos providers ativos em paralelo → salva `outlook_event_id` e/ou `google_event_id`
- Ao atualizar/deletar: sincroniza com os providers onde o evento existe
- `GET /api/hearings/calendar/:year/:month` — agrega eventos de ambos os providers, remove duplicatas
- Workflow n8n `hearing-reminders.json`:
  - Trigger: cron diário 08:00
  - GET /internal/hearings/pending-reminders
  - Para cada audiência: verifica D-3, D-2, D-1 separadamente
  - Envia WhatsApp para cliente E para advogado com templates diferentes
  - Atualiza flags reminder_d3_sent, reminder_d2_sent, reminder_d1_sent
- Frontend: FullCalendar com eventos unificados de ambos os calendários, badge indicando origem (Outlook / Google / Ambos), drag-and-drop para reagendar (sincroniza em todos os providers)

**Critério de conclusão:** Audiência criada → evento aparece no Outlook E no Google Calendar → D-3 WhatsApp enviado para cliente e advogado → reagendar no sistema atualiza ambos os calendários.

---

### FASE 9 — Monitoramento PJe/Eproc + Deep Links
**Escopo:** Leitura de emails dos tribunais, parse com Gemini, alertas urgentes, botão "Abrir no PJe"

**IMPORTANTE — Limitação da API do PJe:**
A API em docs.pje.jus.br é INTERNA ao ecossistema CNJ — usa Keycloak próprio e não aceita
autenticação de sistemas externos. Não é possível enviar petições, criar processos ou fazer
upload de documentos diretamente via API. Todos os sistemas jurídicos do mercado (Astrea,
Advbox, Projuris) operam da mesma forma: geram o PDF e o advogado anexa manualmente.
O LEX segue o mesmo fluxo correto. NÃO tentar integração direta com a API interna do PJe.

**O que criar:**
- `courtNotifications.controller.ts` + `courtNotifications.routes.ts`
- `OutlookMailService.ts` — listMessages filtrado por domínio, markAsRead
- `POST /internal/court-notifications/ingest` — endpoint para n8n
- `GET /internal/monitored-domains/all` — lista domínios ativos por advogado
- Workflow n8n `court-email-monitor.json` conforme Seção 12
- `GeminiService.parseCourtEmail(emailBody)` — extrai dados estruturados
- Lógica de urgência: intimação com prazo < 5 dias → WhatsApp imediato
- Vinculação automática ao processo pelo número extraído
- Frontend: página "Notificações Judiciais" com filtros, badge de urgentes, ação "Marcar como visto"
- Configurações: página para adicionar/remover domínios monitorados

**Deep Links — botão "Abrir no Tribunal" na ficha do processo:**
Gerar link direto para o processo no portal público do tribunal com base no
`court_system` e `state` do processo. Abre em nova aba no browser do advogado.

```typescript
// services/CourtDeepLinkService.ts
export function generateCourtLink(process: Process): string | null {
  const num = process.process_number  // formato: NNNNNNN-DD.AAAA.J.TT.OOOO
  if (!num) return null

  // Remover formatação para usar na URL
  const numRaw = num.replace(/[.\-]/g, '')

  const links: Record<string, string> = {
    // PJe por estado
    'pje_RJ': `https://pje.tjrj.jus.br/pjekz/processo/${num}`,
    'pje_SP': `https://pje.tjsp.jus.br/pjekz/processo/${num}`,
    'pje_MG': `https://pje.tjmg.jus.br/pjekz/processo/${num}`,
    // Eproc TJRJ
    'eproc_RJ': `https://eproc.tjrj.jus.br/eprocV2/controlador.php?acao=processo_selecionar&num_processo=${numRaw}`,
    // Consulta pública CNJ (fallback universal)
    'default': `https://www.cnj.jus.br/pjecnj/Processo/ConsultaPublica/listView.seam?numeroProcesso=${num}`,
  }

  const key = `${process.court_system}_${process.state?.toUpperCase()}`
  return links[key] ?? links['default']
}
```

Frontend — botão na ficha do processo:
```
[🔗 Abrir no PJe]  ← abre generateCourtLink() em nova aba
[📋 Copiar número] ← copia process_number para a área de transferência
```

Tabela de portais por sistema/estado no model `MonitoredCourtDomain`:
Adicionar campo `portal_url_pattern` para que o advogado possa customizar
o padrão de URL do seu tribunal específico caso não esteja na lista padrão.

**Critério de conclusão:** Email do PJe recebido → Gemini extrai número do processo e prazo → CourtNotification criada → badge aparece no dashboard → WhatsApp enviado se urgente → botão "Abrir no PJe" na ficha abre o processo direto no portal do tribunal.

---

### FASE 10 — Módulo Financeiro e Desfechos
**Escopo:** Honorários, parcelas, desfechos, alertas de cobrança

**O que criar:**
- `financial.controller.ts` + `financial.routes.ts`
- Cálculo automático: `calculated_fee = cause_value * (percentage / 100)`
- Geração automática de parcelas com datas mensais
- `ProcessOutcome` — registrar desfecho, calcular honorário de êxito se aplicável
- Alertas de parcela vencida: node-cron diário verifica `Installment.due_date < hoje` → WhatsApp para advogado
- `PUT /api/financial/installments/:id` — marcar como pago → WhatsApp automático para cliente
- Dashboard financeiro: total a receber, recebido no mês, atrasos, gráfico mensal
- Frontend: ficha financeira do processo, lista de parcelas, dashboard financeiro com gráficos (Recharts via Veinx)

**Critério de conclusão:** Processo ganho → advogado registra desfecho "sentença procedente" + valor → sistema calcula honorários → gera parcelas → cliente recebe WhatsApp → ao marcar pago, cliente recebe confirmação automática.

---

### FASE 11 — IA com Gemini
**Escopo:** Todas as integrações Gemini da Seção 15

**O que criar:**
- `services/GeminiService.ts` — métodos para cada caso de uso
- Resumo automático no submit do intake → salva em `process.ai_summary`
- Classificação automática de documento no upload → sugere `document_type`
- Parse de email do tribunal (já integrado na Fase 9, refinar aqui)
- Geração do texto narrativo do PDF de resumo
- Bot WhatsApp inteligente para mensagens não reconhecidas → classificação de intenção
- Frontend: badge "Classificado por IA" nos documentos, botão "Gerar Resumo com IA", indicador visual nas notificações parseadas

**Critério de conclusão:** Cliente faz upload de foto do RG → sistema classifica automaticamente como "identidade" sem intervenção do advogado.

---

### FASE 12 — Dashboard e Deploy
**Escopo:** Dashboard principal, alertas consolidados, otimizações, deploy CloudPanel

**O que criar:**
- `dashboard.controller.ts` + `dashboard.routes.ts`
- Cards: total processos, processos ativos, audiências esta semana, honorários a receber, notificações urgentes
- Mini calendário (próximos 7 dias)
- Gráficos: processos por status (pizza), receitas por mês (barras) — componentes Veinx/Recharts
- Alertas consolidados: prazos vencendo, parcelas atrasadas, documentos pendentes, notificações urgentes
- Últimos 5 processos com status e link
- Script de build: `npm run build` → `pm2 restart juriscontrol-api`
- Nginx config para frontend (SPA fallback)
- `npx prisma migrate deploy` para produção
- PM2 ecosystem file

**Critério de conclusão:** Sistema completo funcionando em produção. Dashboard exibe dados reais. Todos os alertas funcionando.

---

### FASE 13 — Portal do Cliente (Área do Membro)
**Escopo:** Login email+senha para clientes, visualização de processos, upload de documentos pendentes, solicitação de novo caso

**Contexto:** Diferente do portal de intake (token único, uso único), o portal do cliente é uma área autenticada persistente onde o cliente pode acompanhar todos os seus processos, enviar documentos a qualquer momento e se comunicar com o escritório.

#### Autenticação do Portal Cliente
- Login separado do login do advogado: `/portal/login` (rota pública, sem sidebar)
- Credenciais: email + senha (gerados automaticamente quando o intake é concluído, enviados por WhatsApp/email)
- Após o advogado concluir o intake: sistema gera senha aleatória de 8 caracteres → envia por WhatsApp + email
- Role: `cliente` no enum `Role` do Prisma
- JWT com claims: `{ id, role: 'cliente', client_id }` — o `client_id` é usado em todos os controllers

**Estrutura de usuário cliente:**
- O `User` com `role = 'cliente'` é criado vinculado ao `Client` existente
- Relação: `Client.user_portal_id` (novo campo) → aponta para o `User` portal do cliente
- O `User` do portal tem acesso APENAS aos dados do seu próprio `Client`

#### O que criar no backend

**Novos campos em `Client` (migration):**
```prisma
model Client {
  // ... campos existentes ...
  portal_user_id  String?   @unique  // User.id com role=cliente
  portal_user     User?     @relation("ClientPortalUser", fields: [portal_user_id], references: [id])
  portal_enabled  Boolean   @default(false)
}
```

**Novos endpoints:**
```
POST /portal/login                        (público) → retorna JWT com role=cliente
POST /portal/request-password-reset      (público) → envia link de reset por email
POST /portal/reset-password/:token       (público) → altera senha

GET  /api/portal/me                      (cliente) → dados do cliente + processos
GET  /api/portal/processes               (cliente) → lista de processos do cliente
GET  /api/portal/processes/:id           (cliente) → detalhes do processo
GET  /api/portal/processes/:id/documents (cliente) → documentos do processo
POST /api/portal/processes/:id/upload    (cliente) → upload de documento
POST /api/portal/new-case-request        (cliente) → solicita abertura de novo caso
PUT  /api/portal/me                      (cliente) → atualiza dados pessoais
```

**Controller: `portalAuth.controller.ts`**
- `login`: valida email+senha, retorna `{ accessToken, refreshToken, client }` com role=cliente
- `activatePortal(clientId)`: cria User com role=cliente, gera senha, envia por WhatsApp

**Middleware de autorização do portal:**
```typescript
// Garante que o cliente só acessa seus próprios processos
export const requireClientOwnership = (req, res, next) => {
  const clientId = req.params.clientId || req.body.client_id
  if (clientId && clientId !== req.user.client_id) {
    return res.status(403).json({ error: 'Acesso não autorizado' })
  }
  next()
}
```

#### O que criar no frontend

**Páginas do Portal (layout separado — sem sidebar do sistema):**
- `/portal/login` — tela de login minimalista com logo do escritório (obtido via API pública)
- `/portal/dashboard` — resumo do cliente: cards de processos + alertas de documentos pendentes
- `/portal/processes` — lista de processos do cliente com status
- `/portal/processes/:id` — ficha do processo (visão simplificada)
- `/portal/processes/:id/documents` — documentos do processo + upload de pendentes
- `/portal/new-case` — formulário de solicitação de novo caso

**Layout do portal:** Bootstrap 5 (sem sidebar do Veinx), navbar simples com nome do cliente e botão sair. Mobile-first — cliente acessa principalmente pelo celular.

#### Restrições de acesso por estado do processo

| Estado do processo | O que o cliente pode fazer |
|---|---|
| `aberto` | Ver dados + enviar documentos + atualizar dados pessoais |
| `em_andamento` | Ver dados + enviar documentos + ver timeline |
| `aguardando_audiencia` | Ver dados + ver data da audiência + ver documentos |
| PDF unificado gerado (`summary_pdf_url` preenchido) | **Somente leitura** — não pode mais enviar documentos nem editar dados |
| `encerrado` / `ganho` / `perdido` | Somente leitura — pode baixar documentos já gerados |

**Regra crítica:** Uma vez que o advogado gera o PDF final da petição (campo `summary_pdf_url` preenchido no processo), o portal bloqueia novos uploads e edições. O cliente vê um alerta: "Seu processo foi protocolado. Para alterações, entre em contato com o escritório."

#### Fluxo de ativação do portal

```
1. Advogado conclui intake do novo cliente
2. Backend: generateTokenForNewClient → cliente criado com status ativo
3. Advogado acessa ficha do cliente → botão "Ativar Portal do Cliente"
4. Backend: portalAuth.activatePortal(clientId)
   → Cria User { email: client.email, password: hash(senhaAleatoria), role: 'cliente' }
   → Salva client.portal_user_id
   → Envia WhatsApp: "Acesse seu processo em {URL}/portal/login — Login: {email} — Senha: {senha}"
   → Envia email (se disponível): mesmas credenciais
5. Cliente acessa /portal/login → faz login → vê seus processos
6. Na primeira entidade, cliente é redirecionado para alterar a senha
```

#### Solicitação de novo caso pelo portal

O cliente pode solicitar um novo caso sem precisar passar pelo intake completo:
- Formulário: descrição do problema + área do direito (select) + urgência
- Backend cria `CaseRequest` (nova tabela simples) vinculada ao `client_id`
- Advogado recebe notificação (WhatsApp + dashboard) de nova solicitação
- Advogado converte para `Process` com um clique

```prisma
model CaseRequest {
  id           String   @id @default(uuid())
  client_id    String
  client       Client   @relation(fields: [client_id], references: [id])
  description  String   @db.Text
  area         String?  // "trabalhista", "consumidor", etc.
  urgency      String   @default("normal") // "normal" | "urgente"
  status       String   @default("pendente") // "pendente" | "convertido" | "recusado"
  process_id   String?  // preenchido quando advogado converte para processo
  created_at   DateTime @default(now())
}
```

**Critério de conclusão:** Intake concluído → advogado ativa portal → cliente recebe WhatsApp com login+senha → cliente loga em `/portal` → vê seus processos → envia documento pendente → solicita novo caso → advogado converte solicitação em processo com um clique.

---

## 17. SEED DE DADOS INICIAIS

```typescript
// prisma/seed.ts
// Criar:
// 1. Usuário advogado de teste
// 2. Settings padrão para o advogado
// 3. Template padrão de procuração ad judicia
// 4. 2 clientes de exemplo
// 5. 1 processo de exemplo com timeline
// 6. Domínio pje.jus.br configurado para monitoramento
```

---

## 18. OBSERVAÇÕES FINAIS PARA O AGENTE DE IA

**Regras específicas de Fases 2 e 3 — leia antes de qualquer implementação:**

- **Dois PDFs distintos:** `requerimento.pdf` e `processo.pdf` nunca são fundidos. O advogado os baixa separadamente e os anexa no PJe/Eproc um a um.
- **Links de vídeo no requerimento:** o sistema NÃO insere links automaticamente. O advogado digita/cola os links no campo da interface. O sistema formata na seção "Provas Digitais" do requerimento.pdf.
- **Ordem do processo.pdf é hardcoded:** procuração → doc.pessoal → residência → caso. O drag-and-drop só afeta o grupo "caso" (categoria 4). Nunca permitir que os 3 primeiros grupos sejam reordenados.
- **Rotação non-destructive:** o campo `rotation` no banco é apenas metadado. O arquivo original NUNCA é modificado. A rotação é aplicada apenas na geração do PDF final via pdf-lib.
- **Procuração gerada em duas versões:** temporária (para o cliente baixar no intake antes do submit) e definitiva (gerada no submit, com dados salvos no banco). São dois arquivos diferentes. Sempre A4, sem senha, com linha de assinatura manual.
- **Gênero na procuração:** o campo `gender` do cliente controla toda a flexão gramatical (outorgante/a, brasileiro/a, solteiro/a, Dr./Dra.). Sem `gender` preenchido, o sistema usa forma neutra (o/a Outorgante). O campo `social_name`, quando preenchido, substitui `full_name` na procuração. Nunca usar "Dr(a)." para o advogado — resolver pelo campo `gender` do `User`.
- **Imagens de celular:** o método `sharp().rotate()` (sem argumento) corrige automaticamente a orientação EXIF — fotos tiradas na vertical pelo celular chegam rotacionadas corretamente. O campo `rotation` do banco é adicional para correção manual pelo advogado se necessário.
- **Detecção de MIME:** sempre por magic bytes (`file-type`), nunca pela extensão. Um JPG renomeado para PDF é detectado como imagem e tratado como tal.
- **Dois gatilhos de bloqueio independentes:** `process_number !== null` bloqueia edição de dados pessoais pelo portal. `summary_pdf_url !== null` bloqueia upload de documentos pelo portal. Um não implica o outro.
- **Unicidade por escritório:** CPF, RG, e-mail e WhatsApp são únicos dentro de um `user_id`, não globalmente. Em caso de duplicata, retornar 409 com `client_id` para redirecionar.
- **PDFs gerados pelo sistema nunca recebem senha** — nunca adicionar proteção de senha a nenhum arquivo gerado.
- **Upload de vídeo nunca passa pelo servidor** — o servidor apenas cria a sessão e registra o link. O browser faz o upload direto ao OneDrive/Google Drive.
- **Checklist de documentos no Montador:** é apenas aviso visual, NÃO bloqueia a geração do PDF. O advogado pode gerar mesmo com documentos faltando.



- O template Veinx está em `/frontend/venix/`. Antes de criar qualquer componente visual, verifique se já existe um equivalente no Veinx.
- **Nunca chamar OneDrive, Google Drive, Outlook ou Google Calendar diretamente nos controllers** — sempre via `StorageService` e `CalendarService`. Eles resolvem qual provider usar.
- O n8n nunca deve acessar o banco MySQL diretamente — sempre via endpoints `/internal/*`.
- A interface `IWhatsAppProvider` deve ser respeitada em 100% das chamadas ao WhatsApp.
- Toda ação de negócio relevante deve gerar uma entrada na `ProcessTimeline`.
- Prazos de intimação detectados pelo monitor de email são URGENTES e devem disparar WhatsApp imediatamente, sem esperar o ciclo do n8n.
- **Regra do "ambos":** quando `storage_provider = "ambos"` ou `calendar_provider = "ambos"`, usar `Promise.allSettled` (não `Promise.all`) para que a falha de um provider não cancele o outro. Logar o erro do provider que falhou mas retornar sucesso parcial.
- **Google Drive upload de vídeo:** usar resumable upload session da Drive API v3 (`POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`). O fluxo de chunks é idêntico ao OneDrive.
- **Google Calendar:** ao criar o evento, solicitar `conferenceData` para gerar link do Google Meet automaticamente (equivalente ao Teams Meeting do Outlook).
- **Deduplicação no FullCalendar:** quando ambos os calendários estão ativos, eventos com mesmo título e mesma data devem ser exibidos como um único item com badge "Sincronizado" em vez de duplicados.

---

## 19. CORREÇÃO ARQUITETURAL — CLIENTES, INTAKE E ISOLAMENTO DE DADOS

> **Contexto:** Identificado em 2026-05-15 a partir de uso real em produção. Bug crítico de isolamento de documentos e inconsistência no fluxo de intake para novos clientes. Esta seção descreve a arquitetura correta que deve ser seguida por todas as sessões futuras.

---

### 19.1 Modelo de relacionamento Advogado ↔ Cliente

**Regra fundamental:** Cada advogado possui seus próprios registros de clientes. `Client.user_id` pertence a UM único advogado — isso é CORRETO e não deve ser alterado.

Um mesmo indivíduo (ex: "Maria") que é cliente de dois advogados diferentes (João e Paulo) existe como **dois registros separados** no banco — um com `user_id = João` e outro com `user_id = Paulo`. Cada advogado enxerga apenas seus próprios clientes e seus próprios processos.

```
Advogado João              Advogado Paulo
├── Client: Maria (id: A)  ├── Client: Maria (id: B)   ← IDs diferentes, dados isolados
│   └── Process #1         │   └── Process #3
└── Client: Carlos (id: C) └── Client: Ana (id: D)
```

**Por que não usar tabela N:N (ClientAdvogado)?**
- A realidade jurídica brasileira é que cada escritório tem sua própria ficha do cliente com seus próprios documentos. Não há compartilhamento de dados entre escritórios concorrentes.
- A arquitetura atual é simples, segura e correta para o modelo de negócio.

---

### 19.2 Bug de isolamento — documentos de outro advogado visíveis

**Causa:** A query de documentos na tela de cliente buscava `ProcessDocument WHERE process.client_id = clientId` sem filtrar por `process.user_id = req.user.id`.

**Regra absoluta (sem exceção):**
> Toda query que envolva `Process`, `ProcessDocument`, `Hearing`, `FinancialRecord`, `CourtNotification` ou qualquer outra entidade vinculada a um processo **DEVE** incluir `user_id: req.user.id` no `where`. Sem esse filtro, dados de outro advogado podem vazar.

```typescript
// ❌ ERRADO — vaza dados de outros advogados
const docs = await prisma.processDocument.findMany({
  where: { process: { client_id: clientId } }
})

// ✅ CORRETO — isolado por advogado
const docs = await prisma.processDocument.findMany({
  where: {
    process: { client_id: clientId, user_id: req.user.id },
    deleted_at: null,
  }
})
```

---

### 19.3 Schema — mudança em `IntakeToken`

**Problema:** `IntakeToken` não armazenava `user_id`. Quando um novo cliente preenchia um formulário de intake, o backend não sabia a qual advogado vincular o novo `Client`.

**Solução:** Adicionar dois campos ao modelo:

```prisma
model IntakeToken {
  id          String    @id @default(uuid())
  user_id     String                           // ← NOVO: advogado que gerou o link
  user        User      @relation(fields: [user_id], references: [id])
  type        String    @default("atualizar")  // ← NOVO: "novo" | "atualizar"
  process_id  String?
  client_id   String?
  client      Client?   @relation(fields: [client_id], references: [id])
  token       String    @unique @default(uuid())
  expires_at  DateTime
  used_at     DateTime?
  metadata    Json?
  created_at  DateTime  @default(now())
}
```

**Migration necessária:**
```bash
npx prisma migrate dev --name add_user_id_type_to_intake_token
```

**Preenchimento obrigatório ao criar token:**
```typescript
await prisma.intakeToken.create({
  data: {
    user_id: req.user.id,          // sempre o advogado autenticado
    type: client_id ? 'atualizar' : 'novo',
    client_id: client_id ?? null,
    process_id: process_id ?? null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    metadata: { ... }
  }
})
```

---

### 19.4 Dois tipos de token — comportamento obrigatório

#### Tipo `"novo"` — link para novo cliente se cadastrar

**Gerado por:** botão **"Intake — Novo Cliente"** no header da `ClientList`  
**Rota:** `POST /api/intake/generate-new`  
**Body:** `{ name?, whatsapp?, case_title? }` (dados iniciais opcionais)  
**Armazena:** `user_id = req.user.id`, `client_id = null`, `type = "novo"`

**Ao submeter (`POST /api/intake/:token/submit`):**
```typescript
// O token.user_id indica qual advogado vai "receber" o novo cliente
await prisma.$transaction([
  prisma.client.create({
    data: {
      user_id: token.user_id,   // ← advogado que gerou o link
      full_name: body.full_name,
      cpf: body.cpf,
      // ... demais campos
    }
  }),
  // criar Process se case_title informado
  // criar Consent LGPD
  // marcar token.used_at
])
```

**Formulário (frontend):**
- Campos em branco — cliente preenche tudo do zero
- Campo "Descreva brevemente o seu caso" (opcional, cria `Process` se preenchido)
- Consentimento LGPD obrigatório
- SEM lista de processos ativos (é um novo cliente, não há processos ainda)

---

#### Tipo `"atualizar"` — link para cliente existente atualizar dados

**Gerado por:** botão **"🔗 Gerar link"** na coluna de ações da `ClientList` (por linha de cliente)  
**Rota:** `POST /api/intake/generate`  
**Body:** `{ client_id, process_id? }`  
**Armazena:** `user_id = req.user.id`, `client_id = client_id`, `type = "atualizar"`

**Ao abrir o link (frontend):**
- Dados pessoais pré-preenchidos com os dados atuais do cliente
- Se `process_id` informado: exibe seção de upload de documentos + seção de resumo do caso
- Se sem `process_id`: exibe dados pessoais + campo "Solicitar novo processo" (cria `CaseRequest`)
- Lista de processos ativos com AQUELE advogado (read-only, com status e prazo)

**Ao submeter:**
```typescript
await prisma.$transaction([
  prisma.client.update({
    where: { id: token.client_id },
    data: { ...body }            // atualiza dados do cliente existente
  }),
  prisma.consent.create({ ... }), // LGPD
  prisma.intakeToken.update({
    where: { token },
    data: { used_at: new Date() }
  }),
])
```

---

### 19.5 UI — Separação obrigatória dos botões de intake

#### `ClientList.tsx` — header (área de ações globais)

```
[+ Novo Cliente]    [Intake — Novo Cliente]
     ↑                       ↑
Advogado cadastra     Gera link para novo cliente
diretamente           se auto-cadastrar (token tipo "novo")
```

- **"+ Novo Cliente"**: abre modal ou navega para `/clients/new` — advogado preenche diretamente
- **"Intake — Novo Cliente"**: abre modal onde advogado informa nome e WhatsApp do futuro cliente → sistema gera link e envia por WhatsApp (ou exibe para copiar)
- Os dois botões NÃO devem ficar lado a lado sem distinção visual clara — usar estilos diferentes (ex: `btn-primary` e `btn-outline-success`)

#### `ClientList.tsx` — coluna "Ações" (por linha)

```
[👁 Ver]  [✏ Editar]  [🔗 Gerar link intake]
```

- **"🔗 Gerar link intake"**: abre modal para selecionar processo (opcional) e gera token tipo `"atualizar"` para aquele cliente específico

#### `ClientDetails.tsx` — tela de detalhes do cliente (para o advogado)

Deve exibir:
- Dados pessoais em cards
- **Lista de processos filtrada por `user_id` do advogado logado** (não todos os processos do cliente)
- Abas **Ativos** / **Histórico**
- Por processo: título, número, status (badge colorido), prazo pendente, ações (ver, montar petição)
- Botão **"🔗 Gerar link intake"** com seletor de processo → gera token `"atualizar"`
- Botão **"Ativar Portal"** para enviar acesso ao portal do cliente

#### `IntakeForm.tsx` — dois modos de renderização

```typescript
// Ao carregar o token:
const isNewClient = intakeToken.type === 'novo'

if (isNewClient) {
  // modo "novo": campos em branco, sem lista de processos
} else {
  // modo "atualizar": campos pré-preenchidos, lista de processos ativos (read-only)
}
```

---

### 19.6 Tela de processos no portal do cliente

O portal do cliente (`/portal/processes`) lista processos onde o `client.portal_user_id = req.user.id`. Isso é independente do advogado — o cliente pode ter processos com múltiplos advogados que ativaram o portal para ele.

Regras:
- O cliente só vê processos cujo `client.portal_user_id` aponta para o seu `User.id`
- O cliente NÃO vê processos de outros clientes (mesmo que tenham o mesmo CPF)
- O advogado NÃO vê os processos que outros advogados têm com o mesmo cliente

---

### 19.7 Checklist de implementação desta correção

**Backend:**
- [ ] Migration: adicionar `user_id` e `type` em `IntakeToken`
- [ ] `intake.controller.ts` → `generateToken`: salvar `user_id = req.user.id` e `type = "atualizar"`
- [ ] `intake.controller.ts` → `generateTokenNew`: salvar `user_id = req.user.id` e `type = "novo"`
- [ ] `intake.controller.ts` → `submit`: usar `token.user_id` ao criar `Client` (tipo "novo")
- [ ] `intake.controller.ts` → `getStatus`: retornar `token.type` para o frontend saber o modo
- [ ] `clients.controller.ts` → `getOne`: filtrar processos e documentos por `user_id: req.user.id`
- [ ] Verificar todos os `findMany` de `ProcessDocument` — garantir `process: { user_id }` no where

**Frontend:**
- [ ] `ClientList.tsx`: separar botão "Novo Cliente" de "Intake — Novo Cliente" com estilos distintos
- [ ] `ClientList.tsx`: botão "🔗 Gerar link" por linha de cliente (chama rota `generate` com `client_id`)
- [ ] `ClientDetails.tsx`: exibir lista de processos filtrada por `user_id`
- [ ] `IntakeForm.tsx`: renderizar modo "novo" (branco) ou "atualizar" (pré-preenchido) com base em `token.type`
- [ ] `IntakeForm.tsx` modo "atualizar": exibir lista de processos ativos (read-only) com link para solicitar novo caso
