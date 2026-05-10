# 🔧 Configurar Nginx - JurisControl

## Problema

Erro 404 em `/login` ocorre porque o React Router precisa que todas as rotas sejam redirecionadas para o `index.html`.

## Solução

Configurar o Nginx para:
1. Servir o frontend na porta 80/443
2. Redirecionar todas as rotas para `index.html` (React Router)
3. Fazer proxy da API para o backend (porta 3006)
4. Servir assets estáticos do Veinx

---

## Passos no Servidor

### 1. Criar arquivo de configuração

```bash
sudo nano /etc/nginx/sites-available/juriscontrol
```

### 2. Colar a configuração

```nginx
server {
    listen 80;
    server_name lex.m3br.com.br;
    
    # Raiz do frontend
    root /home/m3br-lex/htdocs/lex.m3br.com.br/frontend/dist;
    index index.html;

    # Frontend - React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3006/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # OAuth callbacks
    location /auth/ {
        proxy_pass http://127.0.0.1:3006/auth/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Assets estáticos (Venix)
    location /venix/ {
        alias /home/m3br-lex/htdocs/lex.m3br.com.br/frontend/dist/venix/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
}
```

### 3. Ativar o site

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/juriscontrol /etc/nginx/sites-enabled/juriscontrol

# Remover default (se existir)
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl reload nginx
```

---

## Verificar

### 1. Status do Nginx
```bash
sudo systemctl status nginx
```

### 2. Testar frontend
```bash
curl http://lex.m3br.com.br/login
# Deve retornar o index.html
```

### 3. Testar API
```bash
curl http://lex.m3br.com.br/api/health
# Deve retornar {"status":"ok"}
```

---

## SSL/TLS (Opcional mas recomendado)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d lex.m3br.com.br

# Auto-renew
sudo certbot renew --dry-run
```

---

## Estrutura de Pastas

```
/home/m3br-lex/htdocs/lex.m3br.com.br/
├── backend/
│   └── dist/
│       └── app.js
├── frontend/
│   └── dist/
│       ├── index.html
│       ├── venix/
│       └── assets/
└── nginx.conf (arquivo de config)
```

---

## Ports

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| Nginx | 80/443 | Frontend + Proxy |
| Backend API | 3006 | Node.js |
| Frontend (PM2) | 5174 | Serve (apenas dev) |
| MySQL | 3306 | Banco de dados |

---

## Troubleshooting

### Erro 502 Bad Gateway
```bash
# Verificar se backend está rodando
pm2 status

# Reiniciar backend
pm2 restart juriscontrol-api
```

### Erro 404 em /login
```bash
# Verificar configuração do Nginx
sudo nginx -t

# Verificar se try_files está correto
cat /etc/nginx/sites-available/juriscontrol
```

### Assets não carregam
```bash
# Verificar permissões
ls -la /home/m3br-lex/htdocs/lex.m3br.com.br/frontend/dist/

# Deve estar legível pelo nginx
```

---

**Após configurar o Nginx, o erro 404 será resolvido!**
