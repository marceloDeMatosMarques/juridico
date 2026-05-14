# Configuração de Infraestrutura — m3br.com.br

Guia completo da infraestrutura atual. Leia do início ao fim antes de aplicar qualquer mudança.

---

## Visão Geral

```
Usuário (navegador)
      │
      ▼ HTTPS
┌─────────────────────┐
│     Cloudflare      │  ← SSL termina aqui. Cloudflare entrega HTTPS ao usuário.
│   m3br.com.br       │     Entre Cloudflare e o servidor pode ser HTTP ou HTTPS.
└──────────┬──────────┘
           │ HTTPS (proxy ativo)
           ▼
┌─────────────────────┐
│     CloudPanel      │  ← cp.m3br.com.br — recebe as requisições e faz proxy reverso
│   72.60.14.58       │     para as portas internas dos containers Docker.
└──────────┬──────────┘
           │ HTTP interno
           ▼
┌─────────────────────────────────────────────────────┐
│                  Docker (servidor)                   │
│  rede: app_database                                  │
│                                                      │
│  postgres      → 5432 (interno, sem porta pública)  │
│  redis         → 6379 (interno, sem porta pública)  │
│  evolution-api → 5001 → https://evo.m3br.com.br     │
│  n8n           → 5002 → https://n8n.m3br.com.br     │
└─────────────────────────────────────────────────────┘
```

---

## 1. DNS — Cloudflare

**Painel:** https://dash.cloudflare.com → domínio `m3br.com.br` → DNS

### Registros configurados

| Tipo  | Nome | Conteúdo       | Proxy     | TTL  |
|-------|------|----------------|-----------|------|
| CNAME | evo  | cp.m3br.com.br | ON (laranja) | Auto |
| CNAME | n8n  | cp.m3br.com.br | ON (laranja) | Auto |

### Como funciona o CNAME com proxy

- `evo.m3br.com.br` não aponta diretamente para o IP do servidor
- Aponta para `cp.m3br.com.br` (o CloudPanel), mas **passando pelo proxy do Cloudflare**
- O ícone de nuvem laranja (🟠) significa que o tráfego passa pelo Cloudflare antes de chegar ao servidor
- O ícone cinza (⚪) seria direto — **não usar** para produção

### Adicionar novo subdomínio

1. Cloudflare → DNS → "Adicionar registro"
2. Tipo: `CNAME`
3. Nome: o subdomínio (ex: `api`)
4. Conteúdo: `cp.m3br.com.br`
5. Proxy: **ativado** (nuvem laranja)
6. TTL: Auto
7. Salvar

---

## 2. SSL — Como está configurado

O SSL tem **duas camadas**:

### Camada 1 — Cloudflare → Usuário (obrigatório)
- Cloudflare entrega HTTPS ao usuário final automaticamente
- Certificado gerenciado pelo próprio Cloudflare, renovação automática
- Nada a configurar — funciona pelo proxy ativo

### Camada 2 — CloudPanel → Cloudflare
- O CloudPanel tem certificado SSL próprio (Let's Encrypt)
- Configurado em: CloudPanel → Sites → domínio → SSL/TLS → Let's Encrypt
- **Modo recomendado no Cloudflare:** `Full (strict)` — SSL em ambos os lados

### Verificar modo SSL no Cloudflare
1. Cloudflare → domínio `m3br.com.br` → SSL/TLS → Visão geral
2. Deve estar em **Full** ou **Full (strict)**
3. Nunca deixar em **Flexível** (inseguro — envia HTTP entre Cloudflare e servidor)

---

## 3. CloudPanel — Proxy Reverso

**Painel:** https://cp.m3br.com.br:8443

O CloudPanel recebe as requisições dos subdomínios e encaminha para as portas internas do Docker.

### Configuração de cada domínio

| Subdomínio | Proxy interno |
|---|---|
| `evo.m3br.com.br` | `http://127.0.0.1:5001` |
| `n8n.m3br.com.br` | `http://127.0.0.1:5002` |

### Como configurar proxy reverso no CloudPanel

1. CloudPanel → Sites → selecionar domínio
2. Vhost → editar configuração nginx
3. Adicionar bloco `location`:
```nginx
location / {
    proxy_pass http://127.0.0.1:PORTA;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 4. Dockge — Gerenciador de Stacks

O Dockge é uma interface web para gerenciar os `docker compose` de cada serviço individualmente.

### Localização dos arquivos

```
/home/m3br-apps/htdocs/apps.m3br.com.br/dockge-stacks/
├── evelution/          ← Evolution API (nome com typo mantido por compatibilidade)
│   └── compose.yaml
├── n8n/
│   └── compose.yaml
├── postgres/
│   └── compose.yaml
└── redis/
    └── compose.yaml
```

### Sequência de deploy (ordem obrigatória)

1. **postgres** — deve estar UP antes de qualquer outro
2. **redis** — deve estar UP antes do evolution
3. **evelution** — depende de postgres e redis
4. **n8n** — pode subir em paralelo com evolution

### Criar a rede (apenas uma vez, se não existir)

```bash
docker network create app_database

# Verificar
docker network ls | grep app_database
```

### Atualizar um stack no Dockge

1. Acessar o Dockge → selecionar o stack
2. Editar o `compose.yaml`
3. Clicar em "Restart" (ou "Deploy" se for a primeira vez)

### Via SSH (alternativa ao Dockge)

```bash
# Subir/reiniciar
cd /home/m3br-apps/htdocs/apps.m3br.com.br/dockge-stacks/evelution
docker compose up -d --force-recreate

# Ver logs
docker logs -f evolution-api

# Parar
docker compose down
```

---

## 5. Evolution API — Configuração Crítica

### Variável que resolve o QR Code

```yaml
- CONFIG_SESSION_PHONE_VERSION=2.3000.1039501489
```

**Por que é necessária:**
Sem esta variável, o Baileys (biblioteca WhatsApp do Evolution) usa uma versão desatualizada do protocolo WhatsApp. O WhatsApp rejeita a conexão com erro `405 / Connection Failure`, e o QR Code nunca é gerado. Atualizando esta variável, o protocolo correto é enviado e o handshake funciona.

**Como atualizar quando parar de funcionar:**
1. Acessar https://wppconnect.io/pt-BR/whatsapp-versions/
2. Copiar a versão mais recente (formato `2.3000.XXXXXXXXX`)
3. Editar o compose do evolution no Dockge
4. Atualizar a linha `CONFIG_SESSION_PHONE_VERSION=...`
5. Reiniciar o stack

### Acessar a API

```bash
# Health check
curl http://localhost:5001

# Listar instâncias
curl -H "apikey: Evo@ApiKey#2024!M3br" http://localhost:5001/instance/fetchInstances

# Criar instância
curl -X POST http://localhost:5001/instance/create \
  -H "apikey: Evo@ApiKey#2024!M3br" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"juriscontrol","integration":"WHATSAPP-BAILEYS","qrcode":true}'

# Obter QR
curl -H "apikey: Evo@ApiKey#2024!M3br" http://localhost:5001/instance/connect/juriscontrol

# Manager (interface web)
# https://evo.m3br.com.br/manager
```

---

## 6. Diferenças em Relação ao Setup Antigo

| Item | Setup antigo (`/opt/lex-services/`) | Setup atual (Dockge) |
|---|---|---|
| Gerenciador | `docker compose` manual | Dockge (interface web) |
| Localização | `/opt/lex-services/` | `/home/m3br-apps/htdocs/apps.m3br.com.br/dockge-stacks/` |
| Rede Docker | `lex-network` | `app_database` |
| Porta Evolution | `3008` | `5001` |
| Porta N8N | `5678` | `5002` |
| Composição | Um único `docker-compose.yml` | Um `compose.yaml` por serviço |
| CONFIG_SESSION_PHONE_VERSION | **Ausente** (causa do erro 405) | `2.3000.1039501489` ✅ |
| DNS | A record direto no IP | CNAME → `cp.m3br.com.br` via Cloudflare |
| SSL | Let's Encrypt no CloudPanel | Cloudflare (proxy) + Let's Encrypt (CloudPanel) |

---

## 7. Credenciais de Acesso

| Serviço | URL | Credencial |
|---|---|---|
| Cloudflare | https://dash.cloudflare.com | conta Google/email cadastrado |
| CloudPanel | https://cp.m3br.com.br:8443 | usuário/senha do CloudPanel |
| Dockge | (via CloudPanel ou porta direta) | — |
| Evolution Manager | https://evo.m3br.com.br/manager | apikey: `Evo@ApiKey#2024!M3br` |
| N8N | https://n8n.m3br.com.br | usuário criado no primeiro acesso |
| PostgreSQL | interno: `postgres:5432` | user: `postgres` / senha: `PgEvolution2024` |

---

## 8. Checklist de Verificação

```bash
# 1. Rede existe?
docker network ls | grep app_database

# 2. Containers rodando?
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "postgres|redis|evolution|n8n"

# 3. Evolution responde?
curl -s http://localhost:5001 | python3 -m json.tool

# 4. N8N responde?
curl -s -o /dev/null -w "%{http_code}" http://localhost:5002

# 5. Postgres OK?
docker exec postgres pg_isready -U postgres

# 6. Redis OK?
docker exec redis redis-cli ping
```
