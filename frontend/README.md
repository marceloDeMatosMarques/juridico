# Frontend - JurisControl

## Instalação e Deploy

### Desenvolvimento

```bash
npm install --legacy-peer-deps
npm run dev
```

Acesse: http://localhost:5174

### Produção (PM2)

**IMPORTANTE:** O frontend usa Vite para build estático. Para produção, existem duas opções:

#### Opção 1: Usando serve (recomendado para PM2)

```bash
# Build de produção
npm run build

# Instalar serve globalmente
npm install -g serve

# Iniciar com PM2
pm2 start serve --name juriscontrol-frontend -- --port 5174 dist/
```

#### Opção 2: Nginx (produção)

Configurar Nginx para servir os arquivos estáticos de `dist/`:

```nginx
server {
    listen 443 ssl;
    server_name juriscontrol.seudominio.com.br;

    root /var/www/juriscontrol/frontend/dist;
    index index.html;

    # SSL
    ssl_certificate /etc/letsencrypt/live/juriscontrol.seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/juriscontrol.seudominio.com.br/privkey.pem;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3006/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Troubleshooting

### Erro: "serve is not defined"

Instale o serve globalmente:

```bash
npm install -g serve
```

### Erro: "Port 5174 already in use"

Use outra porta:

```bash
pm2 start serve --name juriscontrol-frontend -- --port 5175 dist/
```

### Erro: "Cannot find module 'path'"

Já corrigido no `vite.config.ts` e `tsconfig.node.json`.

---

## Build Output

Após `npm run build`:

```
dist/
├── index.html
└── assets/
    ├── index-*.css
    └── index-*.js
```

Tamanho aproximado:
- HTML: 0.49 kB
- CSS: 1.78 kB
- JS: 213.85 kB

---

## Variáveis de Ambiente

Crie `.env` na raiz do frontend se necessário:

```env
VITE_API_URL=https://api.juriscontrol.com.br
```

---

**Desenvolvido com ❤️ para advogados brasileiros**
