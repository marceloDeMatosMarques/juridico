# 🎨 Usando o Template Veinx

## Estrutura do Veinx

O template Veinx está na pasta `/frontend/Venix/` e contém:

```
Venix/
├── assets/
│   ├── css/         - CSS principal (app.min.css, icons.min.css)
│   ├── fonts/       - Fontes
│   ├── images/      - Imagens (auth/, logos, etc)
│   ├── js/          - JavaScript
│   └── libs/        - Bibliotecas (jQuery, Bootstrap, etc)
├── auth-login.html       - Template de login
├── auth-register.html    - Template de registro
├── auth-recoverpw.html   - Recuperação de senha
└── ... (outros templates)
```

## Como Usar no React

### 1. Assets Automáticos

Os assets do Veinx são copiados automaticamente para `/src/assets/` durante o build.

### 2. CSS

No `index.css`:

```css
@import './assets/css/app.min.css';
@import './assets/css/icons.min.css';
```

### 3. Imagens e SVGs

Use o caminho absoluto da pasta pública:

```jsx
<img src="/venix/assets/images/auth/login_first.svg" alt="" />
<img src="/venix/assets/images/logo-sm.png" alt="" />
```

### 4. JS Libraries

O Vite gerencia automaticamente. Importe no `index.html`:

```html
<script src="/venix/assets/libs/jquery/jquery.min.js"></script>
<script src="/venix/assets/libs/bootstrap/js/bootstrap.bundle.min.js"></script>
```

## Templates Disponíveis

### Auth
- `auth-login.html` - Login
- `auth-register.html` - Registro
- `auth-recoverpw.html` - Recuperar senha
- `auth-lock-screen.html` - Tela de bloqueio
- `auth-confirm-mail.html` - Confirmação de email
- `auth-logout.html` - Logout

### Apps
- `apps-calendar.html` - Calendário
- `apps-chat.html` - Chat
- `apps-contacts.html` - Contatos
- `apps-todolist.html` - Tarefas
- `app-file-manager.html` - Arquivos
- `app-notes.html` - Notas

### Charts
- `charts-area.html` - Área
- `charts-bar.html` - Barras
- `charts-bubble.html` - Bolhas
- `charts-candlestick.html` - Candlestick
- `charts-column.html` - Colunas

## Componentes React

Ao criar componentes React:

1. **Importe o CSS** no `index.css` ou componente
2. **Use as classes** do Veinx (Bootstrap based)
3. **Mantenha a estrutura** HTML dos templates
4. **Use os assets** de `/venix/assets/`

### Exemplo: Card

```jsx
<div className="card">
  <div className="card-body">
    <h5 className="card-title">Título</h5>
    <p className="card-text">Conteúdo</p>
  </div>
</div>
```

### Exemplo: Botão

```jsx
<button className="btn btn-primary">
  Primário
</button>

<button className="btn btn-success">
  Sucesso
</button>
```

## Build de Produção

No build, os assets são copiados para `dist/`:

```bash
npm run build
# dist/venix/assets/...
```

## Caminhos Importantes

| Tipo | Caminho | Exemplo |
|------|---------|---------|
| CSS | `/venix/assets/css/` | `app.min.css` |
| JS | `/venix/assets/js/` | `app.min.js` |
| Imagens | `/venix/assets/images/` | `logo-sm.png` |
| Fonts | `/venix/assets/fonts/` | `fa-regular-400.ttf` |
| Libs | `/venix/assets/libs/` | `bootstrap/` |

## Dicas

1. **Sempre use** os componentes Veinx quando disponíveis
2. **Não crie** componentes Bootstrap do zero
3. **Mantenha** o estilo visual do template
4. **Consulte** os templates HTML de exemplo
5. **Use** as classes utilitárias do Veinx

## Exemplo Completo

```jsx
import './index.css'

export function Login() {
  return (
    <div className="account-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-xl-6">
            <img src="/venix/assets/images/auth/login_first.svg" />
          </div>
          <div className="col-xl-5">
            <div className="card">
              <div className="card-body">
                <h4>Bem-vindo</h4>
                <button className="btn btn-primary">
                  Entrar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

**Importante:** O template Veinx é a base visual do JurisControl. Sempre consulte os templates originais antes de criar novos componentes.
