# EstoquePro — Front-end

Front-end de um sistema web de gerenciamento de estoque multi-empresa (atacado e varejo), flexível para qualquer tipo de produto (alimentos, moda, livros, eletrônicos etc).

Stack: **React 18 + Vite + React Router + Tailwind CSS + lucide-react**, com camada de serviços já preparada para o **Supabase** (Auth + Postgres).

## Como rodar

```bash
npm install
npm run dev
```

O projeto sobe em `http://localhost:5173`. Sem nenhuma configuração adicional, ele já funciona **em modo demonstração**, com dados mockados em memória (`src/data/mockData.js`) — dá pra testar login, cadastro, edição, exclusão e filtros normalmente.

Outros scripts:

```bash
npm run build     # build de produção em /dist
npm run preview   # serve o build localmente
npm run lint      # roda o eslint
```

## Conectando ao Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o script `supabase/schema.sql` (cria as tabelas `companies`, `products`, `categories`, `profiles`, com RLS já habilitado).
3. Copie `.env.example` para `.env` e preencha com as credenciais do projeto (**Project Settings → API**):

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
   ```

4. Reinicie `npm run dev`. A partir daí, `src/lib/supabaseClient.js` passa a exportar um client configurado.
5. Nos arquivos de `src/services/`, troque os blocos comentados com `// TODO Supabase` pelas chamadas reais (`supabase.from(...)`, `supabase.auth...`). A assinatura de todas as funções já é assíncrona, então nada nos componentes/páginas precisa mudar.

Isso mantém o front funcionando com mock enquanto o back não está pronto, e a migração para dados reais é só "destravar" o código já deixado pronto.

## Estrutura de pastas

```
src/
├─ assets/              # imagens e ícones estáticos
├─ components/
│  ├─ layout/            # Sidebar, TopHeader, AppShell (layout com <Outlet />)
│  ├─ products/           # ProductModal, ConfirmDeleteModal, ProductTable, ProductFilters
│  └─ ui/                 # Toast, MetricCard, CategoryBadge (componentes genéricos)
├─ context/               # AuthContext, CompanyContext, ProductContext, ToastContext
├─ data/                  # categorias e dados mockados (fallback sem Supabase)
├─ lib/                   # supabaseClient.js
├─ pages/                 # LoginPage, DashboardPage, StockPage, ProfilePage, NotFoundPage
├─ routes/                # AppRoutes (react-router) e PrivateRoute (rota protegida)
├─ services/               # productService, companyService, authService (camada de dados)
├─ styles/                 # index.css (Tailwind)
├─ utils/                  # formatters.js (datas, moeda, urgência de validade)
├─ App.jsx                 # composição dos providers + rotas
└─ main.jsx                 # entry point (ReactDOM + BrowserRouter)

supabase/
└─ schema.sql             # schema Postgres + RLS pronto para colar no SQL Editor
```

### Por que essa organização

- **`pages/` vs `components/`** — páginas são telas montadas nas rotas; `components/` é tudo reutilizável (layout, produtos, UI genérica).
- **`context/` + `services/`** — os componentes nunca chamam o Supabase diretamente. Eles usam hooks (`useProducts`, `useCompany`, `useAuth`) que, por baixo, chamam `services/*.js`. Isso isola toda a lógica de dados, então trocar mock por Supabase é uma mudança em um só lugar.
- **`routes/`** — `AppRoutes.jsx` centraliza o mapa de rotas; `PrivateRoute.jsx` protege `/dashboard`, `/estoque` e `/perfil`, redirecionando para `/login` quando não autenticado.
- **`data/`** — mantém os dados de demonstração separados da lógica, facilitando remover tudo isso quando o back estiver 100% integrado.

## Rotas

| Rota         | Descrição                                   | Protegida |
|--------------|----------------------------------------------|-----------|
| `/login`     | Autenticação                                  | Não       |
| `/dashboard` | Visão geral, métricas e alertas de validade   | Sim       |
| `/estoque`   | Tabela de produtos, filtros, CRUD             | Sim       |
| `/perfil`    | Dados da empresa e alteração de senha         | Sim       |

## Paleta de cores

| Cor          | Hex       | Uso                                  |
|--------------|-----------|---------------------------------------|
| Azul escuro  | `#0F172A` | Estrutura, menus (`slate-900`)         |
| Dourado      | `#D97706` | CTAs primários, badges (`amber-600`)   |
| Turquesa     | `#0D9488` | Ações secundárias, sucesso (`teal-600`)|
| Branco       | `#FFFFFF` | Cards e contêineres                   |
| Cinza claro  | `#F1F5F9` | Fundo geral (`slate-100`)              |

Esses hex correspondem exatamente às classes padrão do Tailwind (`slate-900`, `amber-600`, `teal-600`, `slate-100`), configuradas também como aliases em `tailwind.config.js` (`navy`, `gold`, `teal`).
# Valida-Facil
