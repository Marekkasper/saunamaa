import { Flame, Paperclip } from "lucide-react";
import type { Message } from "./types";

/** Renders **bold**, *italic* and _italic_ inline. */
function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g);
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_")))
      return <em key={key}>{p.slice(1, -1)}</em>;
    return <span key={key}>{p}</span>;
  });
}

function RichText({ content, dark }: { content: string; dark: boolean }) {
  const paragraphs = content.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) =>
        para.startsWith("::meta ") ? (
          <p key={i} className={`pt-1 text-[11px] ${dark ? "text-white/70" : "text-stone-400"}`}>
            {para.slice(7)}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {inline(para, String(i))}
          </p>
        )
      )}
    </div>
  );
}

function time(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember-100 text-ember-700">
          <Flame className="h-4 w-4" />
        </div>
      )}
      <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-md bg-ember-700 text-white"
              : "rounded-bl-md border border-stone-200 bg-stone-100 text-stone-800"
          } ${message.pending ? "opacity-70" : ""}`}
        >
          {message.attachmentName && (
            <div
              className={`mb-1.5 flex items-center gap-1.5 text-xs ${isUser ? "text-white/85" : "text-stone-500"}`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span className="truncate">{message.attachmentName}</span>
            </div>
          )}
          {message.content === "(file only)" ? null : <RichText content={message.content} dark={isUser} />}
        </div>
        <span className="mt-1 px-1 text-[11px] text-stone-400">
          {message.pending ? "Sending…" : time(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-100 text-ember-700">
        <Flame className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm text-stone-500">
        <span>Typing...</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-steam rounded-full bg-ember-500"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
