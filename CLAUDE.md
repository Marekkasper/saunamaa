# CLAUDE.md – project notes for Claude Code

This project is a **web app that runs on Render, not on this computer**.

- The app is deployed on Render automatically from the **main** branch of this GitHub repo
  (see `render.yaml`: one Node web service + one Render PostgreSQL database).
- The database is a Render PostgreSQL database that is available **only** through the
  `DATABASE_URL` environment variable on Render. Do not set up a local database or a local server.
- Before every push, run `npm run build` to make sure the app builds.
- After each finished task, commit and push to GitHub so that Render deploys the new version.
- Never hard-code credentials. `.env` is git-ignored; `.env.example` documents the variables.

## Stack
Next.js 15 (App Router, TypeScript) · Tailwind CSS · lucide-react · Prisma ORM (PostgreSQL).

## Key files
- `src/components/ChatApp.tsx` – the whole chat UI (sidebar, top bar, chat, input).
- `src/app/api/**` – REST API: `/api/chats`, `/api/chats/[id]`, `/api/chats/[id]/messages`, `/api/prompts`, `/api/prompts/[id]`, `/api/health`.
- `src/lib/mockAi.ts` – simulated LLM (`sendMessage`), 1.5 s delay.
- `data/sauna_knowledge.csv` – Leili's knowledge base (id, topic, keywords, answer).
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.mjs` – data model, migrations, default personas.

## Deploy flow
`build` = `prisma generate && next build`; `start` = `prisma migrate deploy && node prisma/seed.mjs && next start`
(Next.js listens on the `PORT` variable that Render provides).
