# Valida Fácil — Backend

Backend complementar ao Supabase (não substitui o RLS, soma a ele). Feito em **FastAPI**, cobre só o que não dá pra fazer com o front falando direto com o banco:

1. **Onboarding de empresa** e convite de usuários (precisa da chave `service_role`, que nunca pode ir pro front).
2. **Movimentações de estoque** com alerta automático por e-mail quando um produto cruza o estoque mínimo.
3. **Checagem diária de validade** (job agendado) com e-mail resumo por empresa.
4. **Geração de relatórios** em PDF e Excel (estoque atual, movimentações, produtos a vencer, giro de estoque).

O CRUD simples de produtos continua no front, direto via `supabase-js` — o RLS já protege isso sozinho, então duplicar essa lógica aqui só adicionaria complexidade sem ganho de segurança.

## Onde colocar as chaves (importante)

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

| Variável | Onde conseguir | Sensibilidade |
|---|---|---|
| `SUPABASE_URL` | Painel Supabase → Project Settings → API | Pública |
| `SUPABASE_ANON_KEY` | Painel Supabase → Project Settings → API | Pública (mesma do front) |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel Supabase → Project Settings → API | **Secreta.** Ignora todo o RLS. Fica só neste `.env`, nunca no front, nunca em repositório público. |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Seu provedor de e-mail (Gmail com App Password, SendGrid, Resend em modo SMTP, etc.) | Secreta |

O `.env` já está no `.gitignore` — nunca será commitado por acidente.

## Como rodar localmente

Pré-requisito: Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

**WeasyPrint** (geração de PDF) precisa de bibliotecas de sistema. No Ubuntu/Debian:

```bash
sudo apt-get install libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```
No macOS: `brew install pango`. No Windows, o mais simples é rodar via Docker (veja abaixo) para não lidar com essas libs manualmente.

Depois:

```bash
uvicorn app.main:app --reload
```

A API sobe em `http://localhost:8000`. Documentação interativa automática em `http://localhost:8000/docs`.

### Via Docker (evita configurar WeasyPrint na mão)

```bash
docker build -t valida-facil-backend .
docker run --env-file .env -p 8000:8000 valida-facil-backend
```

## Configuração do banco (rodar antes de usar o backend)

Além do `schema.sql` do front, este backend depende de duas migrações extras. No **SQL Editor** do Supabase, nesta ordem:

1. `supabase/functions.sql` — cria a função `apply_stock_movement`, que atualiza quantidade + grava o histórico numa transação atômica.
2. `supabase/storage.sql` — cria o bucket privado `reports` e as policies de RLS do Storage (cada empresa só acessa os próprios relatórios).

## Estrutura

```
app/
├─ main.py               # cria o FastAPI, CORS, inclui os routers, sobe o scheduler
├─ config.py              # lê o .env (pydantic-settings)
├─ core/
│  ├─ supabase_client.py   # fábricas dos clients: anon, service_role, e "por usuário"
│  ├─ security.py           # valida o JWT do Supabase Auth e monta o AuthedUser
│  └─ scheduler.py          # job diário de checagem de validade (APScheduler)
├─ routers/
│  ├─ companies.py          # onboarding + convite de usuário
│  ├─ movements.py          # registrar movimentação + alerta de estoque baixo
│  ├─ alerts.py              # disparo manual de checagem de validade
│  └─ reports.py             # geração de relatório sob demanda
├─ services/
│  ├─ stock_service.py       # chama a função SQL de movimentação, decide se envia e-mail
│  ├─ expiry_service.py       # varre produtos perto de vencer (sob demanda e via scheduler)
│  ├─ report_service.py       # monta o PDF/Excel de cada tipo de relatório
│  ├─ storage_service.py      # sobe o arquivo pro Supabase Storage e gera link assinado
│  └─ email_service.py         # envio via SMTP
├─ schemas/                    # Pydantic — validação de entrada/saída de cada rota
├─ templates/
│  ├─ reports/                  # HTML/Jinja2 renderizado em PDF pelo WeasyPrint
│  └─ emails/                    # HTML dos e-mails de alerta
└─ data/categories.py            # rótulos de categoria (evita query extra nos relatórios)

supabase/
├─ functions.sql     # função apply_stock_movement (movimentação atômica)
└─ storage.sql        # bucket "reports" + RLS do Storage
```

## Por que essa organização (defesa em profundidade)

Toda rota que lê/escreve dado de empresa usa o client "por usuário" (`client_for_token`), amarrado ao JWT de quem fez a requisição — isso significa que o **RLS do Postgres continua sendo a linha de defesa principal**, mesmo passando pelo backend. A chave `service_role` só aparece em dois lugares (onboarding e convite de usuário), porque só ali o RLS legitimamente bloquearia uma operação válida (usuário ainda sem empresa). Em todo o resto, mesmo um bug de lógica no backend não vaza dado de uma empresa pra outra — o banco recusa antes.

## Endpoints

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| POST | `/companies` | Cria empresa e vincula o usuário logado como admin | Usuário logado, sem empresa ainda |
| GET | `/companies/me` | Dados da empresa do usuário logado | Usuário logado |
| POST | `/companies/invite` | Convida novo usuário para a empresa | Admin |
| POST | `/movements` | Registra entrada/saída/ajuste de estoque | Usuário com empresa |
| GET | `/movements/low-stock` | Lista produtos abaixo do estoque mínimo | Usuário com empresa |
| POST | `/alerts/check-expiry` | Dispara checagem de validade manualmente | Admin |
| POST | `/reports/generate` | Gera relatório (PDF/XLSX) e retorna link de download | Usuário com empresa |
| GET | `/health` | Healthcheck | Público |

## Testado

Todo o código foi validado neste ambiente antes da entrega: sintaxe de todos os arquivos Python, importação completa do app (`app.main`), renderização dos 4 templates de relatório e dos 2 templates de e-mail, e geração ponta a ponta dos 8 relatórios (4 tipos × PDF/Excel) com dados simulados.

**Nota de versão:** o `requirements.txt` fixa `pydyf==0.11.0` propositalmente — versões mais novas (0.12+) quebram a geração de PDF do WeasyPrint 62.3 (incompatibilidade de API confirmada durante os testes). Não remova esse pin sem testar a geração de PDF de novo.
