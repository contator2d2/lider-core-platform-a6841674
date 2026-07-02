# LÍDER C.O.R.E. — Self-host no EasyPanel

Estrutura do repositório:

```
.
├── api/            # Backend Express + Prisma + JWT
├── prisma/         # Schema Prisma (compartilhado)
├── src/            # Frontend TanStack Start (React 19 + Tailwind v4)
├── Dockerfile      # Container do frontend
├── api/Dockerfile  # Container do backend
└── docker-compose.yml
```

## Rodar local com Docker

```bash
cp .env.example .env
# edite POSTGRES_PASSWORD, JWT_SECRET e VITE_API_URL
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/health
- Postgres: 5432 (interno ao compose)

O container da API roda `prisma migrate deploy` automaticamente no boot.

## Deploy no EasyPanel

1. **Crie um projeto** no EasyPanel e conecte este repositório.
2. **Serviço Postgres**: use o template oficial. Anote host interno (ex.: `lider_postgres`), user, password e database.
3. **Serviço API** (App type: Docker, Build context: raiz, Dockerfile: `api/Dockerfile`).
   Variáveis de ambiente:
   - `DATABASE_URL=postgresql://USER:PASS@lider_postgres:5432/lidercore?schema=public`
   - `JWT_SECRET` (gere com `openssl rand -hex 48`)
   - `JWT_EXPIRES_IN=7d`
   - `PORT=4000`
   - `CORS_ORIGIN=https://app.seudominio.com`
   Exponha a porta 4000 e atribua um domínio, ex.: `https://api.seudominio.com`.
4. **Serviço Web** (App type: Docker, Build context: raiz, Dockerfile: `Dockerfile`).
   Build args:
   - `VITE_API_URL=https://api.seudominio.com`
   Variáveis de ambiente:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `VITE_API_URL=https://api.seudominio.com`
   Exponha a porta 3000 e atribua o domínio principal, ex.: `https://app.seudominio.com`.

> Importante: `VITE_API_URL` precisa ser passado como **build arg**, porque é injetado no bundle do frontend em tempo de build.

## Migrações

Criar nova migration em dev:

```bash
cd api
cp .env.example .env  # ajuste DATABASE_URL local
npm install
npm run prisma:dev -- --name minha_mudanca
```

Em produção o próprio container roda `prisma migrate deploy` no start.

## Aviso sobre o preview do Lovable

O ambiente de preview do Lovable executa apenas o frontend em modo dev. Como o backend Express roda em outro container, login e chamadas de dados **não funcionam no preview** — apenas depois do deploy no EasyPanel (ou rodando `docker compose up` local).