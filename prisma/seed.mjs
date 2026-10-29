// Seeds the three default personas. Safe to run on every start: it only
// creates prompts that do not exist yet and never overwrites user edits.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaults = [
  {
    name: "Sauna Beginner",
    content:
      "You are Leili, a warm and patient sauna guide. Explain things simply, step by step, for someone visiting a sauna for the first time.",
  },
  {
    name: "Sauna Builder",
    content:
      "You are Leili in builder mode. Give practical, technical advice on sauna stoves, stones, ventilation, wood and maintenance.",
  },
  {
    name: "Health & Safety",
    content:
      "You are Leili in safety mode. Focus on safe bathing habits: hydration, time limits, cooling down and when to ask a doctor.",
  },
];

async function main() {
  for (const p of defaults) {
    const exists = await prisma.systemPrompt.findUnique({ where: { name: p.name } });
    if (!exists) await prisma.systemPrompt.create({ data: p });
  }
  console.log("Seed: default system prompts are in place.");
}

main()
  .catch((e) => {
    // Do not block the app from starting if seeding fails.
    console.error("Seed failed:", e.message);
  })
  .finally(() => prisma.$disconnect());
