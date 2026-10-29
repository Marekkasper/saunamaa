"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { SystemPrompt } from "./types";
import { api } from "./http";

type Props = {
  open: boolean;
  prompts: SystemPrompt[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

export default function PromptsModal({ open, prompts, onClose, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
      setConfirmDelete(null);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function reset() {
    setEditingId(null);
    setName("");
    setContent("");
    setError(null);
  }

  function startEdit(p: SystemPrompt) {
    setEditingId(p.id);
    setName(p.name);
    setContent(p.content);
    setError(null);
  }

  async function save() {
    if (!name.trim() || !content.trim()) {
      setError("Please fill in both the name and the prompt text.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await api(`/api/prompts/${editingId}`, { method: "PUT", body: JSON.stringify({ name, content }) });
      } else {
        await api(`/api/prompts`, { method: "POST", body: JSON.stringify({ name, content }) });
      }
      reset();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 5000);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/prompts/${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      setConfirmDelete(null);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompts-title"
    >
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 id="prompts-title" className="font-display text-lg font-semibold text-stone-900">
              Manage Prompts
            </h2>
            <p className="text-xs text-stone-500">Personas shape how Leili answers. Saved in the database.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {prompts.length === 0 && <p className="text-sm text-stone-500">No prompts yet. Add one below.</p>}
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`group rounded-xl border px-3 py-2.5 ${
                editingId === p.id ? "border-ember-300 bg-ember-50" : "border-stone-200 bg-stone-50"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">{p.name}</p>
                  <p className="line-clamp-2 text-xs text-stone-500">{p.content}</p>
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="rounded-md p-1.5 text-stone-500 hover:bg-white hover:text-stone-900"
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  disabled={busy}
                  className={`rounded-md p-1.5 text-xs ${
                    confirmDelete === p.id
                      ? "bg-red-600 px-2 text-white"
                      : "text-stone-500 hover:bg-white hover:text-red-600"
                  }`}
                  aria-label={`Delete ${p.name}`}
                >
                  {confirmDelete === p.id ? "Delete?" : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-stone-200 px-5 py-4">
          <p className="text-sm font-medium text-stone-800">{editingId ? "Edit prompt" : "Add a new prompt"}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Smoke Sauna Expert"
            maxLength={60}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-ember-500 focus:ring-2 focus:ring-ember-100"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe how Leili should behave…"
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-ember-500 focus:ring-2 focus:ring-ember-100"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                onClick={reset}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ember-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-ember-800 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Save changes" : "Add prompt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
