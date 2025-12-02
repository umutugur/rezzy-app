// src/api/assistant.ts
import { api } from "./client";

export type AssistantSuggestion = {
  label: string;
  message: string;
};

export type AssistantResponse = {
  ok: boolean;
  intent: string;
  confidence: number;
  matchedExample?: string;
  reply: string;
  suggestions?: AssistantSuggestion[];
};

export async function sendAssistantMessage(params: {
  message: string;
  language?: string;
}): Promise<AssistantResponse> {
  const res = await api.post<AssistantResponse>("/assistant/message", params);
  return res.data;
}