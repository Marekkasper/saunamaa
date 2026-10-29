import fs from "node:fs";
import path from "node:path";

export type KnowledgeEntry = {
  id: string;
  topic: string;
  keywords: string[];
  answer: string;
};

let cache: KnowledgeEntry[] | null = null;

/** Minimal RFC 4180 CSV parser (handles quoted fields, commas and "" escapes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.length)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.length)) rows.push(row);
  return rows;
}

export function loadKnowledge(): KnowledgeEntry[] {
  if (cache) return cache;
  try {
    const file = path.join(process.cwd(), "data", "sauna_knowledge.csv");
    const [, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
    cache = rows.map(([id, topic, keywords, answer]) => ({
      id,
      topic,
      keywords: (keywords ?? "")
        .split(";")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
      answer: answer ?? "",
    }));
  } catch (e) {
    console.error("Could not load knowledge base:", (e as Error).message);
    cache = [];
  }
  return cache;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ö/g, "o")
    .replace(/ä/g, "a")
    .replace(/õ/g, "o")
    .replace(/ü/g, "u");

/** Scores every entry by keyword hits and returns the best matches. */
export function searchKnowledge(query: string, limit = 2) {
  const q = ` ${normalize(query).replace(/[^\p{L}\p{N}\s-]/gu, " ")} `;
  return loadKnowledge()
    .map((entry) => {
      let score = 0;
      for (const kw of entry.keywords) {
        const k = normalize(kw);
        if (k.includes(" ")) {
          if (q.includes(k)) score += 3;
        } else if (new RegExp(`\\s${k}(s|es|ing|ed)?\\s`).test(q)) {
          score += 2;
        } else if (k.length > 4 && q.includes(k)) {
          score += 1;
        }
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function randomTopics(n = 3) {
  const all = loadKnowledge();
  return [...all].sort(() => Math.random() - 0.5).slice(0, n).map((e) => e.topic);
}
