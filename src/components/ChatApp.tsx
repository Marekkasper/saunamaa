"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Eraser,
  Flame,
  Loader2,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import MessageBubble, { TypingIndicator } from "./MessageBubble";
import PromptsModal from "./PromptsModal";
import { api } from "./http";
import type { ChatDetail, ChatSettings, ChatSummary, Message, SystemPrompt } from "./types";

const MODELS = ["GPT-4", "Claude", "Local Llama"];
const MAX_LEN = 4000;
const SUGGESTIONS = [
  "How hot should a sauna be?",
  "How do I throw löyly properly?",
  "How do I store a birch whisk?",
  "Is it safe to drink alcohol in the sauna?",
];

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function ChatApp() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [settings, setSettings] = useState<ChatSettings>({
    model: "GPT-4",
    temperature: 0.7,
    topP: 0.9,
    systemPromptId: null,
  });

  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [typing, setTyping] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbDown, setDbDown] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSettingsRef = useRef<(() => Promise<void>) | null>(null);

  const showError = useCallback((e: unknown) => {
    const err = e as Error & { status?: number };
    if (err.status === 503) setDbDown(true);
    setError(err.message ?? "Something went wrong.");
  }, []);

  // ---------- Loading ----------
  const loadChats = useCallback(async () => {
    const list = await api<ChatSummary[]>("/api/chats");
    setChats(list);
    return list;
  }, []);

  const loadPrompts = useCallback(async () => {
    const list = await api<SystemPrompt[]>("/api/prompts");
    setPrompts(list);
    return list;
  }, []);

  const openChat = useCallback(
    async (id: string) => {
      await flushSettingsRef.current?.();
      setLoadingChat(true);
      setError(null);
      setSidebarOpen(false);
      try {
        const chat = await api<ChatDetail>(`/api/chats/${id}`);
        setActiveChat(chat);
        setSettings({
          model: chat.model,
          temperature: chat.temperature,
          topP: chat.topP,
          systemPromptId: chat.systemPromptId,
        });
      } catch (e) {
        showError(e);
        if ((e as { status?: number }).status === 404) {
          setActiveChat(null);
          loadChats().catch(() => {});
        }
      } finally {
        setLoadingChat(false);
      }
    },
    [loadChats, showError]
  );

  const init = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const health = await api<{ database: string }>("/api/health");
      if (health.database !== "up") {
        setDbDown(true);
        return;
      }
      setDbDown(false);
      const [list, promptList] = await Promise.all([loadChats(), loadPrompts()]);
      setSettings((s) => ({ ...s, systemPromptId: s.systemPromptId ?? promptList[0]?.id ?? null }));
      if (list.length) await openChat(list[0].id);
    } catch (e) {
      showError(e);
    } finally {
      setInitialLoading(false);
    }
  }, [loadChats, loadPrompts, openChat, showError]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChat?.messages.length, typing]);

  // Auto-expanding textarea
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // ---------- Settings (saved per chat) ----------
  // Changes are merged into one pending patch, so moving both sliders quickly
  // saves both values (not just the last one).
  const pendingPatch = useRef<{ chatId: string; patch: Partial<ChatSettings> } | null>(null);

  const flushSettings = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingPatch.current;
    pendingPatch.current = null;
    if (!pending) return;
    try {
      await api(`/api/chats/${pending.chatId}`, { method: "PATCH", body: JSON.stringify(pending.patch) });
    } catch (e) {
      showError(e);
    }
  }, [showError]);
  flushSettingsRef.current = flushSettings;

  function updateSettings(patch: Partial<ChatSettings>, debounce = false) {
    setSettings((s) => ({ ...s, ...patch }));
    if (!activeChat) return;
    const id = activeChat.id;
    const prev = pendingPatch.current?.chatId === id ? pendingPatch.current.patch : {};
    if (pendingPatch.current && pendingPatch.current.chatId !== id) flushSettings();
    pendingPatch.current = { chatId: id, patch: { ...prev, ...patch } };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (debounce) saveTimer.current = setTimeout(flushSettings, 400);
    else flushSettings();
  }

  // ---------- Chat actions ----------
  async function createChat(): Promise<ChatDetail | null> {
    try {
      const chat = await api<ChatDetail>("/api/chats", {
        method: "POST",
        body: JSON.stringify(settings),
      });
      setActiveChat(chat);
      setChats((c) => [{ id: chat.id, title: chat.title, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, ...c]);
      setSidebarOpen(false);
      setError(null);
      setTimeout(() => textRef.current?.focus(), 50);
      return chat;
    } catch (e) {
      showError(e);
      return null;
    }
  }

  async function deleteChat(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((c) => (c === id ? null : c)), 5000);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await api(`/api/chats/${id}`, { method: "DELETE" });
      setChats((c) => c.filter((x) => x.id !== id));
      if (activeChat?.id === id) setActiveChat(null);
    } catch (e) {
      showError(e);
    }
  }

  async function clearChat() {
    if (!activeChat || activeChat.messages.length === 0) return;
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    setConfirmClear(false);
    try {
      await api(`/api/chats/${activeChat.id}/messages`, { method: "DELETE" });
      setActiveChat({ ...activeChat, title: "New chat", messages: [] });
      setChats((c) => c.map((x) => (x.id === activeChat.id ? { ...x, title: "New chat" } : x)));
    } catch (e) {
      showError(e);
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (typing) return;
    if (!content && !file) {
      setError("Please type a message before sending.");
      textRef.current?.focus();
      return;
    }
    if (content.length > MAX_LEN) {
      setError(`Your message is too long (${content.length} characters). Please keep it under ${MAX_LEN}.`);
      return;
    }
    setError(null);
    await flushSettings(); // make sure the answer uses the latest slider values

    let chat = activeChat;
    if (!chat) chat = await createChat();
    if (!chat) return;

    const attachmentName = file?.name ?? null;
    const temp: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: content || "(file only)",
      attachmentName,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    const chatId = chat.id;
    setActiveChat((c) => (c && c.id === chatId ? { ...c, messages: [...c.messages, temp] } : c));
    setInput("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setTyping(true);

    try {
      const res = await api<{ userMessage: Message; assistantMessage: Message; title: string }>(
        `/api/chats/${chatId}/messages`,
        { method: "POST", body: JSON.stringify({ content, attachmentName }) }
      );
      setActiveChat((c) =>
        c && c.id === chatId
          ? {
              ...c,
              title: res.title,
              messages: [...c.messages.filter((m) => m.id !== temp.id), res.userMessage, res.assistantMessage],
            }
          : c
      );
      setChats((list) => {
        const existing = list.find((x) => x.id === chatId);
        const updated = { id: chatId, title: res.title, updatedAt: res.assistantMessage.createdAt, createdAt: existing?.createdAt ?? res.userMessage.createdAt };
        return [updated, ...list.filter((x) => x.id !== chatId)];
      });
    } catch (e) {
      // Roll back the optimistic message and give the text back to the user.
      setActiveChat((c) => (c && c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== temp.id) } : c));
      setInput(content);
      showError(e);
    } finally {
      setTyping(false);
      textRef.current?.focus();
    }
  }

  const activePrompt = prompts.find((p) => p.id === settings.systemPromptId) ?? null;
  const messages = activeChat?.messages ?? [];
  const tooLong = input.length > MAX_LEN;

  // ---------- Render ----------
  const sidebar = (
    <aside className="flex h-full w-[260px] flex-col border-r border-stone-200 bg-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Chat History</h2>
        <button
          className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {initialLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading chats…
          </div>
        )}
        {!initialLoading && chats.length === 0 && (
          <p className="px-3 py-2 text-sm text-stone-400">No conversations yet.</p>
        )}
        {chats.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center rounded-lg ${
              activeChat?.id === c.id ? "bg-ember-50 text-ember-900" : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            <button onClick={() => openChat(c.id)} className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2 text-left">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.title}</span>
                <span className="block text-[11px] text-stone-400">{relativeTime(c.updatedAt)}</span>
              </span>
            </button>
            <button
              onClick={() => deleteChat(c.id)}
              className={`mr-1.5 rounded-md p-1.5 text-xs transition ${
                confirmDeleteId === c.id
                  ? "bg-red-600 px-2 text-white opacity-100"
                  : "text-stone-400 opacity-100 hover:bg-white hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
              }`}
              aria-label={`Delete chat ${c.title}`}
              title="Delete chat"
            >
              {confirmDeleteId === c.id ? "Delete?" : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        ))}
      </nav>
      <div className="sticky bottom-0 border-t border-stone-200 bg-white p-3">
        <button
          onClick={createChat}
          disabled={dbDown}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-ember-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-ember-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> New Chat
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="h-full shadow-xl">{sidebar}</div>
          <button className="flex-1 bg-stone-900/40" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
        </div>
      )}

      {/* Main panel */}
      <main className="flex min-w-0 flex-1 flex-col bg-stone-50">
        {/* Top bar */}
        <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
            <button
              className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="mr-auto flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-800 text-white shadow-sm">
                <Flame className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="font-display text-base font-semibold text-stone-900">Saunamaa</p>
                <p className="text-[11px] text-stone-500">Leili · your sauna guide</p>
              </div>
            </div>

            <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto] items-center gap-2 sm:flex sm:w-auto">
              <label className="relative min-w-0 sm:flex-none">
                <span className="sr-only">LLM Model</span>
                <select
                  value={settings.model}
                  onChange={(e) => updateSettings({ model: e.target.value })}
                  className="w-full appearance-none rounded-lg border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm text-stone-800 shadow-sm outline-none focus:border-ember-500 focus:ring-2 focus:ring-ember-100"
                  title="LLM Model"
                >
                  {MODELS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              </label>
              <label className="relative min-w-0 sm:flex-none">
                <span className="sr-only">System Prompt</span>
                <select
                  value={settings.systemPromptId ?? ""}
                  onChange={(e) => updateSettings({ systemPromptId: e.target.value || null })}
                  className="w-full appearance-none rounded-lg border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm text-stone-800 shadow-sm outline-none focus:border-ember-500 focus:ring-2 focus:ring-ember-100 sm:max-w-[190px]"
                  title="System Prompt"
                >
                  <option value="">No persona</option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              </label>
              <button
                onClick={() => setPromptsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-700 shadow-sm hover:bg-stone-50 sm:px-3"
                aria-label="Manage Prompts"
                title="Manage Prompts"
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Manage Prompts</span>
              </button>
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className={`rounded-lg border p-2 shadow-sm ${
                  settingsOpen
                    ? "border-ember-300 bg-ember-50 text-ember-800"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                }`}
                aria-expanded={settingsOpen}
                aria-label="Advanced settings"
                title="Advanced settings"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Advanced settings (collapsible) */}
          {settingsOpen && (
            <div className="grid gap-4 border-t border-stone-100 bg-stone-50/70 px-4 py-3 sm:grid-cols-2 sm:px-5">
              {(
                [
                  ["temperature", "Temperature", "Higher = more playful answers"],
                  ["topP", "Top-P", "Higher = adds related tips"],
                ] as const
              ).map(([key, label, hint]) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label htmlFor={key} className="text-sm font-medium text-stone-700">
                      {label}
                    </label>
                    <span className="rounded-md bg-white px-2 py-0.5 font-mono text-sm text-ember-700 shadow-sm">
                      {settings[key].toFixed(1)}
                    </span>
                  </div>
                  <input
                    id={key}
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings[key]}
                    onChange={(e) => updateSettings({ [key]: Number(e.target.value) }, true)}
                    className="slider"
                  />
                  <p className="mt-1 text-[11px] text-stone-400">
                    {hint} · {activeChat ? "saved for this chat" : "applies to your next chat"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* Error banner */}
        {(error || dbDown) && (
          <div className="mx-3 mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              {dbDown
                ? "Leili can't reach the sauna database right now. Your chats are safe – please try again in a moment."
                : error}
            </div>
            {dbDown ? (
              <button onClick={init} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            ) : (
              <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-red-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Chat window */}
        <div className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-6 sm:px-5">
            {loadingChat && (
              <div className="flex justify-center py-10 text-stone-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {!loadingChat && messages.length === 0 && (
              <div className="flex flex-col items-center px-2 pt-6 text-center sm:pt-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-ember-400 to-ember-800 text-white shadow-lg shadow-ember-200">
                  <Flame className="h-8 w-8" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-stone-900 sm:text-3xl">Tere! I&apos;m Leili.</h1>
                <p className="mt-2 max-w-md text-[15px] text-stone-600">
                  Your Saunamaa guide to sauna culture: löyly, temperatures, birch whisks, safety and building your own
                  sauna. Pick a question to start{activePrompt ? ` – answering as “${activePrompt.name}”` : ""}.
                </p>
                <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={typing || dbDown}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm text-stone-700 shadow-sm transition hover:border-ember-300 hover:bg-ember-50 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingChat && messages.map((m) => <MessageBubble key={m.id} message={m} />)}
            {typing && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <footer className="border-t border-stone-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">
            {file && (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-700">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="rounded p-0.5 hover:bg-stone-200"
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div
              className={`flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 ${
                tooLong ? "border-red-300 focus-within:ring-red-100" : "border-stone-300 focus-within:border-ember-400 focus-within:ring-ember-100"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                aria-label="Attach File"
                title="Attach File"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                ref={textRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Type your message..."
                className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] text-stone-900 outline-none placeholder:text-stone-400"
              />
              <button
                onClick={clearChat}
                disabled={!activeChat || messages.length === 0 || typing}
                className={`hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-40 sm:inline-flex ${
                  confirmClear ? "border-red-600 bg-red-600 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-50"
                }`}
              >
                <Eraser className="h-4 w-4" />
                {confirmClear ? "Confirm?" : "Clear Chat"}
              </button>
              <button
                onClick={() => send()}
                disabled={typing || dbDown}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ember-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-ember-800 disabled:opacity-50 sm:px-4"
                aria-label="Send"
              >
                {typing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-stone-400">
              <button
                onClick={clearChat}
                disabled={!activeChat || messages.length === 0 || typing}
                className={`inline-flex items-center gap-1 disabled:opacity-40 sm:hidden ${confirmClear ? "font-medium text-red-600" : ""}`}
              >
                <Eraser className="h-3.5 w-3.5" /> {confirmClear ? "Tap again to clear" : "Clear Chat"}
              </button>
              <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
              <span className={tooLong ? "font-medium text-red-600" : ""}>
                {input.length > MAX_LEN * 0.8 ? `${input.length}/${MAX_LEN}` : ""}
              </span>
            </div>
            <p className="mt-1 text-center text-[11px] text-stone-400">
              © 2026 Saunamaa. Built with Claude Code
            </p>
          </div>
        </footer>
      </main>

      <PromptsModal
        open={promptsOpen}
        prompts={prompts}
        onClose={() => setPromptsOpen(false)}
        onChanged={async () => {
          try {
            const list = await loadPrompts();
            if (settings.systemPromptId && !list.some((p) => p.id === settings.systemPromptId)) {
              updateSettings({ systemPromptId: list[0]?.id ?? null });
            }
          } catch (e) {
            showError(e);
          }
        }}
      />
    </div>
  );
}
