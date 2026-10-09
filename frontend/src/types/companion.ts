/**
 * AI Companion Types mapped to backend Pydantic schemas.
 */

export type MessageRole = 'user' | 'assistant' | 'system';
// --- Chat ---

export interface ChatRequest {
  content: string;
  task_id: string | null;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  task_id: string | null;
  role: MessageRole;
  content: string;
  token_count: number | null;
  created_at: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  total: number;
}

// --- Current Task ---

export interface CurrentTaskSet {
  task_id?: string | null;
  context_note?: string | null;
  is_active?: boolean;
}

export interface CurrentTask {
  user_id: string;
  task_id: string | null;
  context_note: string | null;
  is_active: boolean;
  started_at: string | null;
  updated_at: string;
}

// --- Error Handling ---

export interface APIError extends Error {
  status?: number;
  data?: any;
  isNetworkError?: boolean;
}
