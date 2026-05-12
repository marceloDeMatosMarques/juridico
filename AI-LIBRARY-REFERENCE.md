# 🚀 Venix Template - AI Library Reference

> **Template:** Venix - Responsive Admin Dashboard Template v1.0.0  
> **Framework:** Bootstrap 5  
> **Author:** Zoyothemes  
> **Path Base:** `/Venix_v1.0.0/`

---

## 📦 Core Dependencies

| Library | Version | Local Path | Purpose |
|---------|---------|------------|---------|
| **Bootstrap** | 5.x | `assets/libs/bootstrap/` | CSS Framework |
| **jQuery** | 3.x | `assets/libs/jquery/` | DOM Manipulation |
| **Iconify Icon** | Latest | `assets/libs/iconify-icon/` | Icons (100k+) |
| **Feather Icons** | Latest | `assets/libs/feather-icons/` | Minimalist Icons |
| **Tabler Icons** | Latest | `assets/libs/@tabler/icons/` | SVG Icons |

---

## 📊 Charts & Visualization

| Library | Local Path | Usage Example |
|---------|------------|---------------|
| **ApexCharts** | `assets/libs/apexcharts/` | `charts-apex-*.html` |
| **ECharts** | `assets/libs/echarts/` | Alternative chart library |
| **Peity** | `assets/libs/peity/` | Mini charts (sparklines) |

### Chart Types Available (ApexCharts)
- Line, Area, Bar, Column, Pie, Donut
- Radar, Polar Area, Bubble, Scatter
- Heatmap, Treemap, BoxPlot, Candlestick
- RadialBar, Funnel, Timeline, Range Area, Mixed

---

## 📋 Tables

| Library | Local Path | Extensions |
|---------|------------|------------|
| **DataTables** | `assets/libs/datatables.net*/` | Buttons, KeyTable, Responsive, Select, BS5 |
| **Simple DataTables** | `assets/libs/simple-datatables/` | Lightweight alternative |

### DataTables Extensions
- `datatables.net-buttons` - Export CSV, Excel, PDF, Print
- `datatables.net-keytable` - Keyboard navigation
- `datatables.net-responsive` - Mobile-friendly
- `datatables.net-select` - Row selection

---

## 📝 Forms & Editors

| Library | Local Path / Package | Purpose |
|---------|------------|---------|
| **Flatpickr** | `assets/libs/flatpickr/` | Date/Time Picker |
| **Quill** | `assets/libs/quill/` | Rich Text Editor (WYSIWYG) |
| **Dropzone** | `assets/libs/dropzone/` | File Upload (Drag & Drop) |
| **react-select** | `npm: react-select@5` | Select pesquisável (equivalente React do Select2) — campo único com busca integrada |

### react-select — Uso no React/TypeScript

> **Quando usar:** Sempre que precisar de um `<select>` com busca integrada (substitui o padrão de dois campos: input de busca + select separado).  
> **Não usar o Select2 jQuery** — este projeto é React/Vite, sem jQuery no bundle de produção.

```tsx
import Select, { type StylesConfig } from 'react-select'

type MyOption = { value: string; label: string }

// Estilos Bootstrap 5 compatíveis
const selectStyles: StylesConfig<MyOption> = {
  control: (base, state) => ({
    ...base,
    minHeight: 'calc(1.5em + 0.75rem + 2px)',
    borderColor: state.isFocused ? '#86b7fe' : '#dee2e6',
    boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13,110,253,.25)' : 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    '&:hover': { borderColor: state.isFocused ? '#86b7fe' : '#dee2e6' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0.25rem 0.75rem' }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: '#6c757d' }),
  menu: (base) => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : 'white',
    color: state.isSelected ? 'white' : '#212529',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#212529' }),
  indicatorSeparator: () => ({ display: 'none' }),
}

// Uso no componente:
const [options] = useState<MyOption[]>([
  { value: 'id1', label: 'Nome 1' },
  { value: 'id2', label: 'Nome 2' },
])
const [selected, setSelected] = useState<string>('')

<Select<MyOption>
  options={options}
  value={selected ? options.find(o => o.value === selected) ?? null : null}
  onChange={opt => setSelected(opt?.value ?? '')}
  placeholder="Buscar..."
  isSearchable
  noOptionsMessage={() => 'Nenhum resultado'}
  styles={selectStyles}
/>
```

---

## 📅 Calendar & Scheduling

| Library | Local Path | Purpose |
|---------|------------|---------|
| **FullCalendar** | `assets/libs/fullcalendar/` | Calendar component |

---

## 🗺️ Maps

| Library | Local Path | Purpose |
|---------|------------|---------|
| **Gmaps** | `assets/libs/gmaps/` | Google Maps wrapper |
| **JS Vector Map** | `assets/libs/jsvectormap/` | Vector maps |

---

## 🎨 UI Components

| Library | Local Path | Purpose |
|---------|------------|---------|
| **Swiper** | `assets/libs/swiper/` | Carousel/Slider |
| **GLightbox** | `assets/libs/glightbox/` | Lightbox Gallery |
| **Simplebar** | `assets/libs/simplebar/` | Custom Scrollbar |
| **Node Waves** | `assets/libs/node-waves/` | Material Ripple Effects |

---

## 🔧 Utilities

| Library | Local Path | Purpose |
|---------|------------|---------|
| **Moment.js** | `assets/libs/moment/` | Date/Time manipulation |
| **Gumshoe JS** | `assets/libs/gumshoejs/` | Scrollspy navigation |
| **Waypoints** | `assets/libs/waypoints/` | Scroll events |
| **List.js** | `assets/libs/list.js/` | Search/Sort/Filter |
| **jQuery Countdown** | `assets/libs/jquery-countdown/` | Countdown timer |
| **jQuery CounterUp** | `assets/libs/jquery.counterup/` | Number counter animation |

---

## 📁 File Structure Reference

### Core Stylesheets
```
/assets/css/app.min.css         → Main application styles
/assets/css/app-rtl.min.css     → RTL (Right-to-Left) support
/assets/css/icons.min.css       → Icon styles
/assets/css/icons-rtl.min.css   → RTL icon styles
```

### Core JavaScript
```
/assets/js/head.js              → Theme config (light/dark mode)
/assets/js/app.js               → Main application logic
/assets/js/pages/               → Page-specific scripts
```

### External Libraries
```
/assets/libs/                   → All third-party libraries
```

---

## 📄 Page Reference

### Authentication Pages (`auth-*.html`)
| Page | File | Description |
|------|------|-------------|
| Login | `auth-login.html` | With social login (Google, GitHub, Microsoft) |
| Register | `auth-register.html` | User registration |
| Recover Password | `auth-recoverpw.html` | Password recovery |
| Logout | `auth-logout.html` | Logout confirmation |
| Lock Screen | `auth-lock-screen.html` | Session lock |
| Confirm Mail | `auth-confirm-mail.html` | Email verification |

### Dashboard Pages
- `index.html` - Default CRM Dashboard
- `index-dark.html` - Dark mode dashboard
- `index-hover-sidebar.html` - Hover sidebar variant
- `index-rtl.html` - RTL version
- `ecommerce.html` - E-commerce dashboard

### Forms (`forms-*.html`)
- `forms-elements.html` - Form elements (inputs, selects, etc.)
- `forms-pickers.html` - Date/time pickers
- `forms-quilljs.html` - Rich text editor
- `forms-validation.html` - Form validation

### Tables (`tables-*.html`)
- `tables-basic.html` - Basic table examples
- `tables-datatables.html` - DataTables advanced examples

### Charts (`charts-apex-*.html`)
- 18 chart type examples: Area, Bar, Boxplot, Bubble, Candlestick, Column, Funnel, Heatmap, Line, Mixed, Pie, Polar Area, Radar, Radial Bar, Range Area, Scatter, Timeline, Treemap

### UI Components (`ui-*.html`)
- Accordions, Alerts, Avatar, Badges
- Breadcrumb, Buttons, Cards
- Carousel, Collapse, Dropdowns
- Grid, Images, List, Modals
- Pagination, Placeholders, Popovers
- Progress, Scrollspy, Spinners
- Tabs, Tooltips, Typography, Video

### Icons (`icons-*.html`)
- `icons-feather.html` - Feather icons
- `icons-mdi.html` - Material Design Icons

### Applications
- `app-contacts-list.html` - Contacts
- `app-file-manager.html` - File manager
- `app-integrations.html` - Integrations
- `app-notes.html` - Notes
- `apps-calendar.html` - Calendar (FullCalendar)
- `apps-chat.html` - Chat
- `apps-todolist.html` - Todo list

### Error Pages
- `error-404.html` - Not Found
- `error-429.html` - Too Many Requests
- `error-500.html` - Internal Server Error
- `error-503.html` - Service Unavailable

### Utility Pages
- `maintenance.html` - Maintenance mode
- `pages-coming-soon.html` - Coming soon
- `pages-faqs.html` - FAQs
- `pages-gallery.html` - Photo gallery
- `pages-invoice.html` - Invoice template
- `pages-pricing.html` - Pricing tables
- `pages-starter.html` - Blank starter page
- `pages-timeline.html` - Timeline view

---

## 🎯 Icon Usage

### Iconify (Recommended - 100k+ icons)

> **React/TypeScript setup required:**
> 1. `src/types/iconify.d.ts` must exist with `declare module 'react' { namespace JSX { interface IntrinsicElements { 'iconify-icon': {...} } } }` and `export {}`
> 2. `index.html` must load `<script src="assets/libs/iconify-icon/iconify-icon.min.js"></script>` before `</body>`
> 3. `index.html` must load `<script src="assets/libs/bootstrap/js/bootstrap.bundle.min.js"></script>` for Bootstrap JS (dropdowns)
> 4. **NEVER load the full `assets/js/app.js`** — it conflicts with React's sidebar state management via jQuery

```tsx
// In React/TSX components:
<iconify-icon icon="solar:hamburger-menu-linear" />
<iconify-icon icon="solar:bell-bing-linear" />
<iconify-icon icon="solar:home-2-linear" />
<iconify-icon icon="solar:eye-linear" />
<iconify-icon icon="solar:pen-linear" />
<iconify-icon icon="solar:trash-bin-2-linear" />
<iconify-icon icon="solar:link-circle-linear" />
<iconify-icon icon="solar:settings-linear" />
<iconify-icon icon="solar:logout-2-linear" />
<iconify-icon icon="solar:users-group-rounded-linear" />
<iconify-icon icon="solar:document-text-linear" />
<iconify-icon icon="solar:dollar-circle-linear" />
<iconify-icon icon="solar:inbox-in-linear" />
<iconify-icon icon="solar:folder-open-linear" />
<iconify-icon icon="solar:clipboard-text-linear" />
<iconify-icon icon="solar:chat-round-like-linear" />
<iconify-icon icon="solar:send-twice-bold" />
```

> **Timeline/className-only contexts:** Use MDI icons (already in icons.min.css):
> `<i className="mdi mdi-eye-outline" />` — prefix is `mdi mdi-[name]`

> **⚠️ icons.min.css contains ONLY: MDI (mdi-*) and Tabler Icons (ti-*)**
> Remix Icons (ri-*) are NOT included — using ri-* classes will show blank icons.

### Feather Icons
```html
<i data-feather="home"></i>
<i data-feather="user"></i>
<i data-feather="settings"></i>
```

---

## ✅ AI Checklist - Creating New Pages

When creating new pages or components, AI should:

1. ✅ Use `index.html` as base structure reference
2. ✅ Include `assets/css/app.min.css` as main CSS
3. ✅ **Do NOT load `assets/js/app.js`** (conflicts with React sidebar management)
4. ✅ Use Iconify for icons (`<iconify-icon icon="solar:...">`) — requires `iconify-icon.min.js` script in index.html
5. ✅ Use MDI (`mdi mdi-[name]`) only when icon must be a CSS className string
5. ✅ Check `assets/libs/` for available libraries
6. ✅ Reuse components from existing pages
7. ✅ Maintain dark mode compatibility
8. ✅ Ensure responsive design
9. ✅ Follow Bootstrap 5 conventions
10. ✅ Reference existing page examples before creating new code

---

## 🔍 Quick Reference - Common Patterns

### Include Scripts (Order Matters)
```html
<!-- Head -->
<link rel="stylesheet" href="assets/css/app.min.css">
<link rel="stylesheet" href="assets/css/icons.min.css">

<!-- Body End -->
<script src="assets/js/head.js"></script>
<script src="assets/js/app.js"></script>
```

### Chart Example (ApexCharts)
```javascript
const options = {
  series: [{
    name: 'Series 1',
    data: [31, 40, 28, 51, 42, 109, 100]
  }],
  chart: {
    type: 'line',
    height: 350
  }
};
const chart = new ApexCharts(document.querySelector("#chart"), options);
chart.render();
```

### DataTable Example
```javascript
const table = new DataTable('#myTable', {
  responsive: true,
  buttons: ['copy', 'csv', 'excel', 'pdf', 'print']
});
```

### Date Picker Example (Flatpickr)
```javascript
flatpickr("#datepicker", {
  dateFormat: "Y-m-d",
  defaultDate: "today"
});
```

### Rich Text Editor (Quill)
```javascript
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: true
  }
});
```

---

## 🌟 Key Features

- ✅ **Bootstrap 5** - Core CSS framework
- ✅ **Dark Mode** - Built-in with toggle
- ✅ **RTL Support** - Full Right-to-Left support
- ✅ **Responsive** - Mobile-first design
- ✅ **No CDN Dependencies** - All libraries bundled locally
- ✅ **100k+ Icons** - Via Iconify
- ✅ **Form Validation** - Bootstrap native
- ✅ **Rich Text Editor** - Quill.js
- ✅ **Advanced Tables** - DataTables with extensions
- ✅ **18 Chart Types** - ApexCharts
- ✅ **Calendar** - FullCalendar integration
- ✅ **Maps** - Google Maps & Vector Maps

---

## 📚 Documentation

Full documentation available in `/Documentation/` folder:
- `index.html` - Main documentation
- `getting-started.html` - Setup guide
- `folder-structure.html` - Directory structure
- `resources-plugins.html` - Plugin references
- `changelog.html` - Version history

---

> **Note:** All libraries are bundled locally in `assets/libs/` - no external CDN dependencies required for core functionality.
