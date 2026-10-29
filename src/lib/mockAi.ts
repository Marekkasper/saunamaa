import { randomTopics, searchKnowledge } from "./knowledge";

export type AiSettings = { temperature: number; topP: number };
export type Persona = { name: string; content: string } | null;

const PROVERBS = [
  "As the old saying goes: the sauna is the poor man's pharmacy.",
  "Finns say you should behave in the sauna as you would in church.",
  "In Estonia they say: Saturday without a sauna is like a week without rest.",
  "Good löyly is soft, not sharp – patience makes the best steam.",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Simulated LLM. Waits ~1.5 s and builds an answer from the Saunamaa
 * knowledge base (data/sauna_knowledge.csv), shaped by persona and settings.
 */
export async function sendMessage(
  text: string,
  model: string,
  settings: AiSettings,
  persona: Persona,
  attachmentName?: string | null
): Promise<string> {
  await sleep(1500);

  const trimmed = text.trim();
  const greeting = /^(hi|hello|hey|tere|moi|terve|good (morning|evening))\b/i.test(trimmed);
  const matches = searchKnowledge(trimmed, 2);
  const parts: string[] = [];

  if (attachmentName) {
    parts.push(
      `📎 I can see you attached **${attachmentName}**. In this demo I can't read files yet, but I'll gladly answer questions about it.`
    );
  }

  if (greeting && matches.length === 0) {
    parts.push(
      "Tere! I'm **Leili**, the Saunamaa sauna guide. Ask me about temperature, löyly, birch whisks, sauna safety or how to build your own sauna."
    );
  } else if (matches.length === 0) {
    parts.push(
      `Hmm, that one is outside my sauna wisdom. Try asking about: ${randomTopics(3)
        .map((t) => `*${t}*`)
        .join(", ")}.`
    );
  } else {
    const [best, second] = matches;
    parts.push(`**${best.entry.topic}**\n\n${best.entry.answer}`);
    // Higher Top-P → "consider more candidates": add a related tip.
    if (second && settings.topP >= 0.8) {
      parts.push(`**Related – ${second.entry.topic}:** ${second.entry.answer}`);
    }
  }

  const personaName = persona?.name.toLowerCase() ?? "";
  if (matches.length) {
    if (personaName.includes("beginner")) {
      parts.push("🌿 Beginner tip: start low, go slow, and leave whenever you like.");
    } else if (personaName.includes("builder")) {
      parts.push("🔧 Builder tip: always follow the heater manufacturer's safety distances.");
    } else if (personaName.includes("safety") || personaName.includes("health")) {
      parts.push(
        "🩺 Safety reminder: drink water, skip alcohol, and ask a doctor first if you have heart or blood-pressure issues."
      );
    } else if (persona) {
      parts.push(`_(Answering as “${persona.name}”.)_`);
    }
  }

  // Higher temperature → more playful.
  if (settings.temperature >= 0.7 && matches.length) {
    parts.push(`🔥 ${PROVERBS[Math.floor(Math.random() * PROVERBS.length)]}`);
  }

  parts.push(`::meta Simulated ${model} answer · temperature ${settings.temperature.toFixed(1)} · top-p ${settings.topP.toFixed(1)}`);
  return parts.join("\n\n");
}
