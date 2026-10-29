export type ChatSummary = { id: string; title: string; updatedAt: string; createdAt: string };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentName?: string | null;
  createdAt: string;
  pending?: boolean;
};

export type ChatDetail = {
  id: string;
  title: string;
  model: string;
  temperature: number;
  topP: number;
  systemPromptId: string | null;
  messages: Message[];
};

export type SystemPrompt = { id: string; name: string; content: string };

export type ChatSettings = {
  model: string;
  temperature: number;
  topP: number;
  systemPromptId: string | null;
};
