# 📚 Documentação Completa - Stack Evolution API + N8N

---

## 🎯 Visão Geral

Stack completo para automação WhatsApp com Evolution API v2 e N8N, utilizando PostgreSQL e Redis como infraestrutura.

### **Arquitetura**

```
┌─────────────────────────────────────────────────────────┐
│                    CloudPanel + SSL                      │
│  evo.m3br.com.br → 5001  |  n8n.m3br.com.br → 5002     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Docker Network                         │
│                    app_database                          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │  Redis   │  │Evolution │  │  N8N   │ │
│  │  :5432   │  │  :6379   │  │  :5001   │  │ :5002  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

### **Serviços**

| Serviço | URL | Porta | Arquivo Compose |
|---------|-----|-------|-----------------|
| **PostgreSQL** | - | 5432 | `postgres-compose.yaml` |
| **Redis** | - | 6379 | `redis-compose.yaml` |
| **Evolution API** | https://evo.m3br.com.br | 5001 | `evolution-compose.yaml` |
| **N8N** | https://n8n.m3br.com.br | 5002 | `n8n-compose.yaml` |

---

## 📋 Pré-requisitos

### **1. Criar rede Docker**
```bash
docker network create app_database
```

### **2. Liberar portas no CloudPanel**
```
Firewall → Security → Add Rule
Type: Custom
Port Range: 5000-5010
Protocol: TCP
Source: 0.0.0.0/0
Description: Dockge + Evolution + N8N
```

### **3. Configurar DNS**
```
Tipo A: evo.m3br.com.br  → [IP do servidor]
Tipo A: n8n.m3br.com.br  → [IP do servidor]
```

### **4. Estrutura de arquivos**
```
/home/m3br-apps/htdocs/apps.m3br.com.br/dockge-stacks/
├── docker-sistema.md                    ← Este arquivo
├── postgres-compose.yaml                ← Configuração PostgreSQL
├── redis-compose.yaml                   ← Configuração Redis
├── evolution-compose.yaml               ← Configuração Evolution API
└── n8n-compose.yaml                     ← Configuração N8N
```

---

## 🗄️ 1. PostgreSQL

**Arquivo de configuração:** `postgres-compose.yaml`

### **Especificações**
- **Imagem:** `postgres:16`
- **Container:** `postgres`
- **Porta:** `5432`
- **Usuário:** `postgres`
- **Senha:** `PgEvolution2024`
- **Banco:** `evolution`
- **Rede:** `app_database`
- **Volume:** `postgres_data` → `/var/lib/postgresql/data`

### **Deploy no Dockge**
1. Criar novo stack: `postgres`
2. Copiar conteúdo de `postgres-compose.yaml`
3. Clicar em "Deploy"

### **Comandos úteis**

```bash
# Conectar no banco
docker exec -it postgres psql -U postgres -d evolution

# Listar bancos
docker exec -it postgres psql -U postgres -c "\l"

# Listar tabelas
docker exec -it postgres psql -U postgres -d evolution -c "\dt"

# Alterar senha
docker exec -it postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'NovaSenha123';"

# Backup
docker exec -it postgres pg_dump -U postgres evolution > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
cat backup.sql | docker exec -i postgres psql -U postgres evolution

# Ver logs
docker logs -f postgres

# Verificar conexões ativas
docker exec -it postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Verificar se está rodando
docker ps | grep postgres

# Testar conexão
docker exec -it postgres pg_isready -U postgres

# Ver uso de disco
docker exec -it postgres du -sh /var/lib/postgresql/data

# Reiniciar
docker restart postgres
```

---

## 🔴 2. Redis

**Arquivo de configuração:** `redis-compose.yaml`

### **Especificações**
- **Imagem:** `redis:alpine`
- **Container:** `redis`
- **Porta:** `6379`
- **Senha:** Sem senha
- **Persistência:** AOF (Append Only File)
- **Rede:** `app_database`
- **Volume:** `redis_data` → `/data`

### **Deploy no Dockge**
1. Criar novo stack: `redis`
2. Copiar conteúdo de `redis-compose.yaml`
3. Clicar em "Deploy"

### **Comandos úteis**

```bash
# Conectar no Redis
docker exec -it redis redis-cli

# Testar conexão
docker exec -it redis redis-cli ping
# Resposta: PONG

# Ver todas as chaves
docker exec -it redis redis-cli KEYS "*"

# Ver chaves do Evolution
docker exec -it redis redis-cli KEYS "evolution*"

# Ver informações
docker exec -it redis redis-cli INFO

# Ver uso de memória
docker exec -it redis redis-cli INFO memory

# Limpar cache (CUIDADO!)
docker exec -it redis redis-cli FLUSHALL

# Limpar apenas cache do Evolution
docker exec -it redis redis-cli --scan --pattern "evolution_cache*" | xargs docker exec -i redis redis-cli DEL

# Ver logs
docker logs -f redis

# Monitorar em tempo real
docker exec -it redis redis-cli MONITOR

# Verificar se está rodando
docker ps | grep redis

# Ver estatísticas
docker exec -it redis redis-cli INFO stats

# Reiniciar
docker restart redis
```

---

## 📱 3. Evolution API v2

**Arquivo de configuração:** `evolution-compose.yaml`

### **Especificações**
- **Imagem:** `atendai/evolution-api:v2.1.1`
- **Container:** `evolution-api`
- **Porta:** `5001` (interna: 8080)
- **URL:** https://evo.m3br.com.br
- **API Key:** `Evo@ApiKey#2024!M3br`
- **Manager:** https://evo.m3br.com.br/manager
- **Documentação:** https://doc.evolution-api.com/v2/pt
- **Rede:** `app_database`
- **Volumes:** 
  - `evolution_instances` → `/evolution/instances`
  - `evolution_store` → `/evolution/store`

### **Deploy no Dockge**
1. Criar novo stack: `evolution-api`
2. Copiar conteúdo de `evolution-compose.yaml`
3. Clicar em "Deploy"

### **Configurar Proxy Reverso no CloudPanel**
```
Domain: evo.m3br.com.br
Reverse Proxy URL: http://127.0.0.1:5001
SSL: Let's Encrypt (Auto)
```

### **Acessar Manager**
```
URL: https://evo.m3br.com.br/manager
API Key: Evo@ApiKey#2024!M3br
```

### **Comandos úteis**

```bash
# Ver logs em tempo real
docker logs -f evolution-api

# Ver últimas 100 linhas
docker logs --tail 100 evolution-api

# Testar API local
curl http://localhost:5001

# Listar instâncias
curl -X GET http://localhost:5001/instance/fetchInstances \
  -H "apikey: Evo@ApiKey#2024!M3br"

# Criar instância
curl -X POST http://localhost:5001/instance/create \
  -H "apikey: Evo@ApiKey#2024!M3br" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "minha-instancia",
    "qrcode": true
  }'

# Ver status de uma instância
curl -X GET http://localhost:5001/instance/connectionState/minha-instancia \
  -H "apikey: Evo@ApiKey#2024!M3br"

# Reiniciar
docker restart evolution-api

# Atualizar imagem
docker pull atendai/evolution-api:v2.1.1
docker restart evolution-api

# Verificar se está rodando
docker ps | grep evolution

# Verificar conectividade com Postgres
docker exec -it evolution-api ping postgres -c 2

# Verificar conectividade com Redis
docker exec -it evolution-api ping redis -c 2

# Ver variáveis de ambiente
docker exec -it evolution-api env | grep -E 'DATABASE|REDIS|SERVER'

# Acessar terminal
docker exec -it evolution-api sh
```

### **Atualizar versão do WhatsApp**

```bash
# 1. Acessar: https://wppconnect.io/pt-BR/whatsapp-versions/
# 2. Copiar a versão mais recente (ex: 2.3000.1039501489)
# 3. Editar evolution-compose.yaml no Dockge
# 4. Atualizar linha:
#    - CONFIG_SESSION_PHONE_VERSION=2.3000.1039501489
# 5. Clicar em "Restart" no Dockge
```

### **Endpoints principais**

```bash
# Health Check
GET http://localhost:5001

# Listar instâncias
GET http://localhost:5001/instance/fetchInstances

# Criar instância
POST http://localhost:5001/instance/create

# Conectar instância
GET http://localhost:5001/instance/connect/{instanceName}

# QR Code
GET http://localhost:5001/instance/qrcode/{instanceName}

# Enviar mensagem
POST http://localhost:5001/message/sendText/{instanceName}

# Documentação completa
https://doc.evolution-api.com/v2/pt
```

---

## 🤖 4. N8N (Automação)

**Arquivo de configuração:** `n8n-compose.yaml`

### **Especificações**
- **Imagem:** `docker.n8n.io/n8nio/n8n`
- **Container:** `n8n`
- **Porta:** `5002` (interna: 5678)
- **URL:** https://n8n.m3br.com.br
- **Rede:** `app_database`
- **Volumes:**
  - `n8n_data` → `/home/node/.n8n`
  - `n8n_files` → `/files`

### **Deploy no Dockge**
1. Criar novo stack: `n8n`
2. Copiar conteúdo de `n8n-compose.yaml`
3. Clicar em "Deploy"

### **Configurar Proxy Reverso no CloudPanel**
```
Domain: n8n.m3br.com.br
Reverse Proxy URL: http://127.0.0.1:5002
SSL: Let's Encrypt (Auto)
```

### **Primeiro acesso**
```
URL: https://n8n.m3br.com.br

1. Criar conta de administrador
2. Configurar email e senha
3. Pronto para usar!
```

### **Comandos úteis**

```bash
# Ver logs
docker logs -f n8n

# Acessar terminal
docker exec -it n8n sh

# Backup workflows
docker exec n8n n8n export:workflow --all --output=/files/backup_$(date +%Y%m%d).json

# Importar workflows
docker exec n8n n8n import:workflow --input=/files/backup.json

# Listar workflows
docker exec n8n n8n list:workflow

# Reiniciar
docker restart n8n

# Atualizar imagem
docker pull docker.n8n.io/n8nio/n8n
docker restart n8n

# Verificar se está rodando
docker ps | grep n8n

# Ver uso de disco
docker exec n8n du -sh /home/node/.n8n
```

### **Integração com Evolution API**

No N8N, ao criar workflows com WhatsApp:

1. **Adicionar nó HTTP Request**
2. **Configurar:**
   ```
   Method: POST
   URL: https://evo.m3br.com.br/message/sendText/sua-instancia
   Authentication: None
   Headers:
     - apikey: Evo@ApiKey#2024!M3br
     - Content-Type: application/json
   Body:
     {
       "number": "5511999999999",
       "text": "Mensagem do N8N"
     }
   ```

---

## 🚀 Sequência de Instalação Completa

### **Passo 1: Preparar ambiente**
```bash
# Criar rede
docker network create app_database

# Verificar
docker network ls | grep app_database
```

### **Passo 2: Deploy PostgreSQL**
```bash
# No Dockge:
# 1. Criar stack "postgres"
# 2. Colar conteúdo de postgres-compose.yaml
# 3. Deploy

# Verificar
docker ps | grep postgres
docker logs postgres
```

### **Passo 3: Deploy Redis**
```bash
# No Dockge:
# 1. Criar stack "redis"
# 2. Colar conteúdo de redis-compose.yaml
# 3. Deploy

# Verificar
docker ps | grep redis
docker exec redis redis-cli ping
```

### **Passo 4: Verificar rede**
```bash
docker network inspect app_database --format '{{range .Containers}}✅ {{.Name}} - {{.IPv4Address}}{{"\n"}}{{end}}'

# Deve aparecer:
# ✅ postgres - 172.19.0.2/16
# ✅ redis - 172.19.0.3/16
```

### **Passo 5: Deploy Evolution API**
```bash
# No Dockge:
# 1. Criar stack "evolution-api"
# 2. Colar conteúdo de evolution-compose.yaml
# 3. Deploy

# Verificar logs
docker logs -f evolution-api

# Aguardar mensagens:
# ✅ Database connected
# ✅ Redis connected
# ✅ Server running on port 8080
```

### **Passo 6: Configurar Proxy Evolution**
```bash
# No CloudPanel:
# 1. Sites → evo.m3br.com.br
# 2. Vhosts → Add Reverse Proxy
# 3. Reverse Proxy URL: http://127.0.0.1:5001
# 4. SSL → Let's Encrypt

# Testar
curl https://evo.m3br.com.br
```

### **Passo 7: Deploy N8N**
```bash
# No Dockge:
# 1. Criar stack "n8n"
# 2. Colar conteúdo de n8n-compose.yaml
# 3. Deploy

# Verificar
docker logs -f n8n
```

### **Passo 8: Configurar Proxy N8N**
```bash
# No CloudPanel:
# 1. Sites → n8n.m3br.com.br
# 2. Vhosts → Add Reverse Proxy
# 3. Reverse Proxy URL: http://127.0.0.1:5002
# 4. SSL → Let's Encrypt

# Testar
curl https://n8n.m3br.com.br
```

### **Passo 9: Verificação final**
```bash
echo "=== CONTAINERS ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n=== REDE app_database ==="
docker network inspect app_database --format '{{range .Containers}}✅ {{.Name}} - {{.IPv4Address}}{{"\n"}}{{end}}'

echo -e "\n=== PORTAS ==="
netstat -tlnp | grep -E '5001|5002|5432|6379'

echo -e "\n=== HEALTH CHECKS ==="
curl -s http://localhost:5001 && echo "✅ Evolution OK"
curl -s http://localhost:5002 && echo "✅ N8N OK"
docker exec postgres pg_isready -U postgres && echo "✅ Postgres OK"
docker exec redis redis-cli ping && echo "✅ Redis OK"
```

**Resultado esperado:**
```
✅ postgres - 172.19.0.2/16
✅ redis - 172.19.0.3/16
✅ evolution-api - 172.19.0.4/16
✅ n8n - 172.19.0.5/16
```

---

## 📊 Resumo de Credenciais

| Serviço | URL/Host | Usuário | Senha/Key | Porta |
|---------|----------|---------|-----------|-------|
| **PostgreSQL** | postgres | postgres | PgEvolution2024 | 5432 |
| **Redis** | redis | - | (sem senha) | 6379 |
| **Evolution API** | https://evo.m3br.com.br | - | Evo@ApiKey#2024!M3br | 5001 |
| **Evolution Manager** | https://evo.m3br.com.br/manager | - | Evo@ApiKey#2024!M3br | - |
| **N8N** | https://n8n.m3br.com.br | (criar no 1º acesso) | - | 5002 |

---

## 🔧 Manutenção e Backup

### **Backup PostgreSQL**
```bash
# Backup completo
docker exec postgres pg_dump -U postgres evolution > evolution_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup compactado
docker exec postgres pg_dump -U postgres evolution | gzip > evolution_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
cat backup.sql | docker exec -i postgres psql -U postgres evolution

# Restore compactado
gunzip -c backup.sql.gz | docker exec -i postgres psql -U postgres evolution
```

### **Backup Redis**
```bash
# Forçar save
docker exec redis redis-cli BGSAVE

# Copiar arquivo RDB
docker cp redis:/data/dump.rdb redis_backup_$(date +%Y%m%d_%H%M%S).rdb
```

### **Backup Evolution**
```bash
# Backup volumes
docker run --rm \
  -v evolution_instances:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/evolution_instances_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

docker run --rm \
  -v evolution_store:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/evolution_store_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### **Backup N8N**
```bash
# Backup workflows
docker exec n8n n8n export:workflow --all --output=/files/workflows_$(date +%Y%m%d_%H%M%S).json

# Copiar para host
docker cp n8n:/files/workflows_*.json ./

# Backup volume completo
docker run --rm \
  -v n8n_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/n8n_data_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### **Atualizar Evolution API**
```bash
# Parar container
docker stop evolution-api

# Backup antes de atualizar
docker run --rm \
  -v evolution_instances:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/evolution_pre_update_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Atualizar imagem
docker pull atendai/evolution-api:v2.1.1

# Iniciar novamente
docker start evolution-api

# Ver logs
docker logs -f evolution-api
```

### **Atualizar N8N**
```bash
# Parar container
docker stop n8n

# Backup workflows
docker exec n8n n8n export:workflow --all --output=/files/backup_pre_update.json

# Atualizar imagem
docker pull docker.n8n.io/n8nio/n8n

# Iniciar novamente
docker start n8n

# Ver logs
docker logs -f n8n
```

---

## 🔍 Monitoramento

### **Script de monitoramento completo**
```bash
#!/bin/bash
# monitor.sh - Monitoramento do stack

echo "=========================================="
echo "MONITORAMENTO - $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

echo -e "\n📦 CONTAINERS"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Size}}" | grep -E "postgres|redis|evolution|n8n"

echo -e "\n🌐 REDE app_database"
docker network inspect app_database --format '{{range .Containers}}✅ {{.Name}} - {{.IPv4Address}}{{"\n"}}{{end}}'

echo -e "\n🗄️ POSTGRESQL"
docker exec postgres psql -U postgres -c "SELECT count(*) as conexoes FROM pg_stat_activity;" 2>/dev/null
docker exec postgres psql -U postgres -d evolution -c "SELECT pg_size_pretty(pg_database_size('evolution')) as tamanho;" 2>/dev/null

echo -e "\n🔴 REDIS"
docker exec redis redis-cli INFO stats | grep -E "total_connections_received|total_commands_processed"
docker exec redis redis-cli INFO memory | grep "used_memory_human"

echo -e "\n📱 EVOLUTION API"
curl -s http://localhost:5001 > /dev/null && echo "✅ API respondendo" || echo "❌ API não responde"
docker logs evolution-api --tail 5 2>/dev/null

echo -e "\n🤖 N8N"
curl -s http://localhost:5002 > /dev/null && echo "✅ N8N respondendo" || echo "❌ N8N não responde"

echo -e "\n💾 USO DE DISCO"
docker system df

echo "=========================================="
```

**Usar:**
```bash
chmod +x monitor.sh
./monitor.sh
```

### **Configurar monitoramento automático (cron)**
```bash
# Editar crontab
crontab -e

# Adicionar (executa a cada 5 minutos)
*/5 * * * * /caminho/para/monitor.sh >> /var/log/docker-monitor.log 2>&1
```

---

## 🚨 Troubleshooting

### **Evolution não conecta no PostgreSQL**
```bash
# 1. Verificar se Postgres está rodando
docker ps | grep postgres

# 2. Testar conexão do Evolution
docker exec -it evolution-api ping postgres -c 2

# 3. Verificar se estão na mesma rede
docker network inspect app_database | grep -E "postgres|evolution"

# 4. Ver logs do Evolution
docker logs evolution-api | grep -i database

# 5. Testar conexão manual
docker exec -it evolution-api sh
apk add postgresql-client
psql postgresql://postgres:PgEvolution2024@postgres:5432/evolution
```

### **Evolution não conecta no Redis**
```bash
# 1. Verificar se Redis está rodando
docker ps | grep redis

# 2. Testar conexão
docker exec -it evolution-api ping redis -c 2

# 3. Testar Redis diretamente
docker exec redis redis-cli ping

# 4. Ver logs do Evolution
docker logs evolution-api | grep -i redis
```

### **QR Code não aparece**
```bash
# 1. Ver logs
docker logs -f evolution-api

# 2. Verificar versão do WhatsApp
# Atualizar em evolution-compose.yaml:
# CONFIG_SESSION_PHONE_VERSION=2.3000.1039501489

# 3. Limpar cache do Redis
docker exec redis redis-cli FLUSHALL

# 4. Reiniciar Evolution
docker restart evolution-api
```

### **N8N não acessa Evolution**
```bash
# 1. Verificar se estão na mesma rede
docker network inspect app_database | grep -E "n8n|evolution"

# 2. Testar do N8N
docker exec n8n ping evolution-api -c 2

# 3. Testar API do Evolution
docker exec n8n wget -O- http://evolution-api:8080

# 4. Usar URL interna no N8N
# http://evolution-api:8080 (dentro da rede Docker)
# https://evo.m3br.com.br (fora da rede Docker)
```

### **Container não inicia**
```bash
# Ver logs completos
docker logs [container-name]

# Ver últimas 50 linhas
docker logs --tail 50 [container-name]

# Ver em tempo real
docker logs -f [container-name]

# Inspecionar container
docker inspect [container-name]

# Verificar recursos
docker stats [container-name]
```

---

## ✅ Checklist de Instalação

- [ ] Rede `app_database` criada
- [ ] Portas 5000-5010 liberadas no firewall
- [ ] DNS configurado (evo.m3br.com.br e n8n.m3br.com.br)
- [ ] PostgreSQL rodando (porta 5432)
- [ ] Redis rodando (porta 6379)
- [ ] Evolution API rodando (porta 5001)
- [ ] N8N rodando (porta 5002)
- [ ] Proxy reverso `evo.m3br.com.br` → 5001 configurado
- [ ] Proxy reverso `n8n.m3br.com.br` → 5002 configurado
- [ ] SSL configurado (Let's Encrypt) para ambos
- [ ] Evolution Manager acessível (https://evo.m3br.com.br/manager)
- [ ] N8N acessível (https://n8n.m3br.com.br)
- [ ] Versão WhatsApp atualizada (https://wppconnect.io/pt-BR/whatsapp-versions/)
- [ ] Todos os containers na rede `app_database`
- [ ] Backup configurado

---

## 📚 Referências

- **Evolution API:** https://doc.evolution-api.com/v2/pt
- **N8N:** https://docs.n8n.io
- **PostgreSQL:** https://www.postgresql.org/docs/
- **Redis:** https://redis.io/docs/
- **WhatsApp Versions:** https://wppconnect.io/pt-BR/whatsapp-versions/
- **Docker Networks:** https://docs.docker.com/network/

---

## 🎉 Instalação Completa!

Seu ambiente está pronto para automação WhatsApp profissional com Evolution API + N8N! 🚀

**Próximos passos:**
1. Acessar Evolution Manager: https://evo.m3br.com.br/manager
2. Criar primeira instância WhatsApp
3. Acessar N8N: https://n8n.m3br.com.br
4. Criar workflows de automação
5. Integrar N8N com Evolution API

**Suporte:**
- Documentação Evolution: https://doc.evolution-api.com/v2/pt
- Comunidade N8N: https://community.n8n.io