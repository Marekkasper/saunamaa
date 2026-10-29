# Saunamaa · Leili – your sauna guide 🔥

Leili is the learning assistant of **Saunamaa**, a (fictional) Estonian company that sells sauna
accessories and teaches sauna culture. Ask Leili about löyly, temperatures, birch whisks,
smoke saunas, sauna safety or building your own sauna.

- **Live app:** _see the Render URL in the repo description_
- **Stack:** Next.js 15 · TypeScript · Tailwind CSS · lucide-react · Prisma · PostgreSQL
- **Hosting:** [Render](https://render.com) web service + Render PostgreSQL, deployed from `main`

## Features
- Chat history sidebar (stored in PostgreSQL): open, delete, start a new chat
- LLM model dropdown (GPT-4 / Claude / Local Llama – simulated)
- Persona (system prompt) dropdown + **Manage Prompts** modal to add, edit and delete personas
- Advanced settings: Temperature and Top-P sliders, saved per chat
- Attach-file button, Clear Chat, typing indicator, timestamps
- Friendly error messages when the database is unreachable or input is invalid
- Responsive: works on desktop and mobile

The "AI" is a mock (`src/lib/mockAi.ts`): after a 1.5 s delay it answers from the
knowledge base in `data/sauna_knowledge.csv`. Persona, temperature and top-p shape the answer.

## Deploying on Render
1. In Render: **New → Blueprint**, pick this repo. Render reads `render.yaml` and creates the
   `saunamaa-db` PostgreSQL database and the `saunamaa-leili` web service, wiring `DATABASE_URL`.
2. Every push to `main` deploys a new version. Migrations and the default personas are applied on start.

Built with Claude Code.
