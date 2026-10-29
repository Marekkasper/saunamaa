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

// Common words that say nothing about the topic.
const STOPWORDS = new Set(
  (
    "a an the and or but if then so to of in on at by for with about from into over after before " +
    "is are was were be been being am do does did doing have has had can could should would will shall may might must " +
    "i me my we our you your he she it its they them their this that these those there here " +
    "what which who whom whose when where why how much many more most some any all each every " +
    "not no yes very really just also too please tell explain know want need like get go going ok okay " +
    "sauna saunas saunaing leili thing things way good best bad better use using used make"
  ).split(" ")
);

const tokenize = (s: string) =>
  normalize(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

// Very small "stemmer": compare the first 5 letters (bathing ~ bathe, heaters ~ heater).
const stem = (w: string) => w.slice(0, 5);

type Hit = { entry: KnowledgeEntry; score: number; fuzzy: boolean };

let textIndex: Map<string, Set<string>> | null = null;
function getTextIndex() {
  if (textIndex) return textIndex;
  textIndex = new Map();
  for (const e of loadKnowledge()) {
    const words = tokenize(`${e.topic} ${e.topic} ${e.keywords.join(" ")} ${e.answer}`);
    textIndex.set(e.id, new Set(words.map(stem)));
  }
  return textIndex;
}

/**
 * Finds the best knowledge-base answers for a question.
 * 1) Keyword matching (multi-word keywords count most).
 * 2) If nothing matches well, a fuzzy search over topic + answer text.
 */
export function searchKnowledge(query: string, limit = 2): Hit[] {
  const q = ` ${normalize(query).replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ")} `;
  const qTokens = tokenize(query);
  const entries = loadKnowledge();

  const keywordHits: Hit[] = entries
    .map((entry) => {
      let score = 0;
      for (const kw of entry.keywords) {
        const k = normalize(kw);
        if (k.includes(" ")) {
          if (q.includes(` ${k}`)) score += 3;
        } else if (new RegExp(`\\s${k}(s|es|ing|ed|ies)?\\s`).test(q)) {
          score += 2;
        } else if (k.length > 4 && q.includes(k)) {
          score += 1;
        }
      }
      // Small bonus when words of the topic title appear in the question.
      if (score > 0) {
        const title = new Set(tokenize(entry.topic).map(stem));
        score += qTokens.filter((t) => title.has(stem(t))).length * 0.5;
      }
      return { entry, score, fuzzy: false };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (keywordHits.length && keywordHits[0].score >= 2) return keywordHits.slice(0, limit);

  // Fuzzy fallback: how many of the question's meaningful words appear in the entry text.
  if (qTokens.length) {
    const index = getTextIndex();
    const needed = qTokens.length <= 1 ? 1 : 2;
    const fuzzyHits: Hit[] = entries
      .map((entry) => {
        const words = index.get(entry.id)!;
        const hits = new Set(qTokens.map(stem).filter((s) => words.has(s))).size;
        return { entry, score: hits, fuzzy: true };
      })
      .filter((r) => r.score >= needed)
      .sort((a, b) => b.score - a.score);
    if (fuzzyHits.length) return fuzzyHits.slice(0, limit);
  }

  return keywordHits.slice(0, limit);
}

export function randomTopics(n = 3) {
  const all = loadKnowledge();
  return [...all].sort(() => Math.random() - 0.5).slice(0, n).map((e) => e.topic);
}
