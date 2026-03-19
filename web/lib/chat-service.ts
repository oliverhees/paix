/**
 * PAIONE Chat Service — WebSocket streaming + REST session management.
 *
 * Communicates with:
 *   - WebSocket /chat/stream (streaming responses)
 *   - GET /chat/sessions (list sessions)
 *   - GET /chat/sessions/:id/messages (session messages)
 *   - POST /chat (non-streaming fallback)
 *   - POST /chat/feedback (message feedback)
 *
 * Uses the API Client from lib/api.ts for REST calls.
 * WebSocket connections are managed independently with JWT auth via query param.
 */

import { api } from "@/lib/api";

// ─── Types ───

export interface ChatSessionSummary {
  id: string;
  title: string;
  last_message_at: string | null;
  message_count: number;
  created_at: string | null;
}

export interface ChatSessionListResponse {
  sessions: ChatSessionSummary[];
  total: number;
}

export interface ChatArtifactResponse {
  id: string;
  title: string;
  artifact_type: string;
  language?: string | null;
  content: string;
}

export interface ChatMessageResponse {
  id: string;
  role: "user" | "assistant";
  content: string;
  skill_used: string | null;
  sources: unknown[];
  artifacts?: ChatArtifactResponse[];
  created_at: string | null;
}

export interface ChatMessagesResponse {
  messages: ChatMessageResponse[];
}

export interface SendMessageResponse {
  id: string;
  session_id: string;
  content: string;
  skill_used: string | null;
  sources: unknown[];
  created_at: string | null;
}

/** Callback for streaming chunks. */
export type OnChunkCallback = (data: {
  content: string;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when streaming completes. */
export type OnEndCallback = (data: {
  message_id: string;
  skill_used: string | null;
  sources: unknown[];
}) => void;

/** Callback for streaming errors. */
export type OnErrorCallback = (data: {
  message: string;
  code: string;
}) => void;

/** Callback when a skill is being used. */
export type OnSkillUsedCallback = (data: {
  skill: string;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when an artifact is created. */
export type OnArtifactCallback = (data: {
  title: string;
  artifact_type: string;
  language?: string;
  content: string;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when the assistant is thinking (processing tools). */
export type OnThinkingCallback = (data: {
  session_id: string;
  message_id: string;
}) => void;

/** Callback when artifact streaming starts (panel should open immediately). */
export type OnArtifactStartCallback = (data: {
  session_id: string;
  message_id: string;
}) => void;

/** Callback for streaming artifact content chunks. */
export type OnArtifactChunkCallback = (data: {
  content: string;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when artifact streaming ends (final source of truth). */
export type OnArtifactEndCallback = (data: {
  title: string;
  artifact_type: string;
  language?: string;
  content: string;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when a tool call starts. */
export type OnToolUseStartCallback = (data: {
  tool_name: string;
  tool_id: string;
  index: number;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when tool input is parsed. */
export type OnToolUseInputCallback = (data: {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when a tool call returns a result. */
export type OnToolUseResultCallback = (data: {
  tool_name: string;
  tool_id: string;
  result: string;
  success: boolean;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when code execution starts in Docker sandbox. */
export type OnCodeExecutionStartCallback = (data: {
  language: string;
  code: string;
  session_id: string;
  message_id: string;
}) => void;

/** Callback when code execution completes. */
export type OnCodeExecutionResultCallback = (data: {
  language: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
  duration_ms: number;
  session_id: string;
  message_id: string;
}) => void;

// ─── WebSocket Manager ───

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getWsUrl(): string {
  const base = API_BASE_URL.replace(/\/api\/v1$/, "");
  return base.replace(/^http/, "ws");
}

class ChatWebSocket {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private onChunk: OnChunkCallback | null = null;
  private onEnd: OnEndCallback | null = null;
  private onError: OnErrorCallback | null = null;
  private onSkillUsed: OnSkillUsedCallback | null = null;
  private onArtifact: OnArtifactCallback | null = null;
  private onThinking: OnThinkingCallback | null = null;
  private onArtifactStart: OnArtifactStartCallback | null = null;
  private onArtifactChunk: OnArtifactChunkCallback | null = null;
  private onArtifactEnd: OnArtifactEndCallback | null = null;
  private onToolUseStart: OnToolUseStartCallback | null = null;
  private onToolUseInput: OnToolUseInputCallback | null = null;
  private onToolUseResult: OnToolUseResultCallback | null = null;
  private onCodeExecutionStart: OnCodeExecutionStartCallback | null = null;
  private onCodeExecutionResult: OnCodeExecutionResultCallback | null = null;
  private onDisconnect: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setCallbacks(callbacks: {
    onChunk: OnChunkCallback;
    onEnd: OnEndCallback;
    onError: OnErrorCallback;
    onSkillUsed?: OnSkillUsedCallback;
    onArtifact?: OnArtifactCallback;
    onThinking?: OnThinkingCallback;
    onArtifactStart?: OnArtifactStartCallback;
    onArtifactChunk?: OnArtifactChunkCallback;
    onArtifactEnd?: OnArtifactEndCallback;
    onToolUseStart?: OnToolUseStartCallback;
    onToolUseInput?: OnToolUseInputCallback;
    onToolUseResult?: OnToolUseResultCallback;
    onCodeExecutionStart?: OnCodeExecutionStartCallback;
    onCodeExecutionResult?: OnCodeExecutionResultCallback;
    onDisconnect?: () => void;
  }) {
    this.onChunk = callbacks.onChunk;
    this.onEnd = callbacks.onEnd;
    this.onError = callbacks.onError;
    this.onSkillUsed = callbacks.onSkillUsed ?? null;
    this.onArtifact = callbacks.onArtifact ?? null;
    this.onThinking = callbacks.onThinking ?? null;
    this.onArtifactStart = callbacks.onArtifactStart ?? null;
    this.onArtifactChunk = callbacks.onArtifactChunk ?? null;
    this.onArtifactEnd = callbacks.onArtifactEnd ?? null;
    this.onToolUseStart = callbacks.onToolUseStart ?? null;
    this.onToolUseInput = callbacks.onToolUseInput ?? null;
    this.onToolUseResult = callbacks.onToolUseResult ?? null;
    this.onCodeExecutionStart = callbacks.onCodeExecutionStart ?? null;
    this.onCodeExecutionResult = callbacks.onCodeExecutionResult ?? null;
    this.onDisconnect = callbacks.onDisconnect ?? null;
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prefer explicitly set token, then fall back to API client's token
      const token = this.token || api.getAccessToken();
      if (!token) {
        reject(new Error("No auth token available for WebSocket"));
        return;
      }

      const wsUrl = `${getWsUrl()}/api/v1/chat/stream?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "chunk":
              this.onChunk?.({
                content: data.content,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "end":
              this.onEnd?.({
                message_id: data.message_id,
                skill_used: data.skill_used ?? null,
                sources: data.sources ?? [],
              });
              break;

            case "error":
              this.onError?.({
                message: data.message || "Unknown error",
                code: data.code || "UNKNOWN",
              });
              break;

            case "skill_used":
              this.onSkillUsed?.({
                skill: data.skill,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "artifact":
              this.onArtifact?.({
                title: data.title,
                artifact_type: data.artifact_type,
                language: data.language,
                content: data.content,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "artifact_start":
              this.onArtifactStart?.({
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "artifact_meta":
              this.onArtifact?.({
                title: data.title,
                artifact_type: data.artifact_type,
                language: data.language,
                content: "",
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "artifact_chunk":
              this.onArtifactChunk?.({
                content: data.content,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "artifact_end":
              this.onArtifactEnd?.({
                title: data.title,
                artifact_type: data.artifact_type,
                language: data.language,
                content: data.content,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "thinking":
              this.onThinking?.({
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "tool_use_start":
              this.onToolUseStart?.({
                tool_name: data.tool_name,
                tool_id: data.tool_id,
                index: data.index,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "tool_use_input":
              this.onToolUseInput?.({
                tool_name: data.tool_name,
                tool_id: data.tool_id,
                input: data.input,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "tool_use_result":
              this.onToolUseResult?.({
                tool_name: data.tool_name,
                tool_id: data.tool_id,
                result: data.result,
                success: data.success,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "code_execution_start":
              this.onCodeExecutionStart?.({
                language: data.language,
                code: data.code,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;

            case "code_execution_result":
              this.onCodeExecutionResult?.({
                language: data.language,
                stdout: data.stdout,
                stderr: data.stderr,
                exit_code: data.exit_code,
                timed_out: data.timed_out,
                duration_ms: data.duration_ms,
                session_id: data.session_id,
                message_id: data.message_id,
              });
              break;
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      this.ws.onerror = () => {
        reject(new Error("WebSocket connection error"));
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.onDisconnect?.();
      };
    });
  }

  async send(content: string, sessionId?: string, model?: string): Promise<void> {
    // Ensure connection
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      try {
        await this.connect();
      } catch {
        // Connection failed, will throw below
      }
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const message: Record<string, string> = {
      type: "message",
      content,
    };

    if (sessionId) {
      message.session_id = sessionId;
    }

    if (model) {
      message.model = model;
    }

    this.ws.send(JSON.stringify(message));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ─── Chat Service ───

class ChatService {
  private wsManager = new ChatWebSocket();

  /**
   * Set the auth token for both REST and WebSocket communication.
   */
  setToken(token: string | null) {
    if (token) {
      api.setTokens(token);
    } else {
      api.clearTokens();
    }
    this.wsManager.setToken(token);
  }

  /**
   * Set WebSocket streaming callbacks.
   */
  setStreamCallbacks(callbacks: {
    onChunk: OnChunkCallback;
    onEnd: OnEndCallback;
    onError: OnErrorCallback;
    onSkillUsed?: OnSkillUsedCallback;
    onArtifact?: OnArtifactCallback;
    onThinking?: OnThinkingCallback;
    onArtifactStart?: OnArtifactStartCallback;
    onArtifactChunk?: OnArtifactChunkCallback;
    onArtifactEnd?: OnArtifactEndCallback;
    onToolUseStart?: OnToolUseStartCallback;
    onToolUseInput?: OnToolUseInputCallback;
    onToolUseResult?: OnToolUseResultCallback;
    onCodeExecutionStart?: OnCodeExecutionStartCallback;
    onCodeExecutionResult?: OnCodeExecutionResultCallback;
    onDisconnect?: () => void;
  }) {
    this.wsManager.setCallbacks(callbacks);
  }

  /**
   * Send a message via WebSocket for streaming response.
   */
  async sendMessageStream(
    content: string,
    sessionId?: string,
    model?: string
  ): Promise<void> {
    return this.wsManager.send(content, sessionId, model);
  }

  /**
   * Send a message via REST (non-streaming fallback).
   */
  async sendMessage(
    message: string,
    sessionId?: string
  ): Promise<SendMessageResponse> {
    return api.post<SendMessageResponse>("/chat", {
      message,
      session_id: sessionId,
    });
  }

  /**
   * List chat sessions for the current user.
   */
  async getSessions(
    limit = 20,
    offset = 0
  ): Promise<ChatSessionListResponse> {
    return api.get<ChatSessionListResponse>(
      `/chat/sessions?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Get messages for a specific session.
   */
  async getSessionMessages(
    sessionId: string,
    limit = 50,
    before?: string
  ): Promise<ChatMessagesResponse> {
    let url = `/chat/sessions/${sessionId}/messages?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    return api.get<ChatMessagesResponse>(url);
  }

  /**
   * Submit feedback for a message.
   */
  async submitFeedback(
    messageId: string,
    rating: "positive" | "negative",
    comment?: string
  ): Promise<void> {
    await api.post("/chat/feedback", {
      message_id: messageId,
      rating,
      comment,
    });
  }

  /**
   * Disconnect WebSocket.
   */
  disconnect() {
    this.wsManager.disconnect();
  }

  get isWebSocketConnected(): boolean {
    return this.wsManager.isConnected;
  }
}

/** Singleton chat service instance. */
export const chatService = new ChatService();
