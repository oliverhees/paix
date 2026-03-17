import { create } from "zustand";
import {
  chatService,
  type ChatSessionSummary,
  type ChatMessageResponse,
} from "@/lib/chat-service";

// ─── Mock data for fallback when backend is not reachable ───

import mockConversations from "@/app/(dashboard)/chat/data.json";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  skill_used?: string | null;
  sources?: unknown[];
  files?: File[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
  messageCount: number;
  /** Category for sidebar grouping (mock compatibility). */
  category?: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: string; // code, markdown, html, mermaid, svg
  language?: string;
  content: string;
  messageId: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  success?: boolean;
  status: "running" | "completed" | "error";
}

export interface CodeExecution {
  language: string;
  code: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  timed_out?: boolean;
  duration_ms?: number;
  status: "running" | "completed" | "error" | "timeout";
}

interface ChatState {
  /** Current chat messages */
  messages: ChatMessage[];
  /** Current active session ID */
  currentSessionId: string | null;
  /** List of past chat sessions */
  sessions: ChatSession[];
  /** Whether the assistant is currently streaming */
  isStreaming: boolean;
  /** Whether we're loading data */
  isLoading: boolean;
  /** Whether the backend is reachable */
  backendAvailable: boolean;
  /** Input draft text */
  inputDraft: string;
  /** Accumulated streaming content for the current assistant response */
  streamingContent: string;
  /** Currently active skill being used by the assistant */
  activeSkill: string | null;
  /** Whether the assistant is thinking (processing tool calls) */
  isThinking: boolean;
  /** Currently displayed artifact in the side panel */
  activeArtifact: Artifact | null;
  /** All artifacts in the current session */
  artifacts: Artifact[];
  /** Whether an artifact is currently being streamed */
  isArtifactStreaming: boolean;
  /** Accumulated streaming content for current artifact */
  streamingArtifactContent: string;
  /** Active tool calls during streaming */
  activeToolCalls: ToolCall[];
  /** Active code execution during streaming */
  activeCodeExecution: CodeExecution | null;

  // ─── Actions ───

  /** Add a single message to the current conversation. */
  addMessage: (message: ChatMessage) => void;
  /** Replace all messages (e.g. when loading a session). */
  setMessages: (messages: ChatMessage[]) => void;
  /** Set the current session ID. */
  setCurrentSessionId: (id: string | null) => void;
  /** Replace all sessions. */
  setSessions: (sessions: ChatSession[]) => void;
  /** Set streaming state. */
  setIsStreaming: (streaming: boolean) => void;
  /** Set loading state. */
  setIsLoading: (loading: boolean) => void;
  /** Set input draft. */
  setInputDraft: (draft: string) => void;
  /** Set the currently active skill. */
  setActiveSkill: (skill: string | null) => void;
  /** Set active artifact (open/close side panel). */
  setActiveArtifact: (artifact: Artifact | null) => void;
  /** Clear messages and reset session. */
  clearMessages: () => void;
  /** Start a completely new session. */
  startNewSession: () => void;
  /** Append a chunk to the in-progress streaming content. */
  appendStreamingContent: (chunk: string) => void;
  /** Reset streaming content accumulator. */
  resetStreamingContent: () => void;

  // ─── Backend-connected actions ───

  /** Load sessions from backend (falls back to mock data). */
  loadSessions: () => Promise<void>;
  /** Load messages for a specific session from backend. */
  loadSessionMessages: (sessionId: string) => Promise<void>;
  /** Send a message via WebSocket streaming. */
  sendMessage: (content: string, files?: File[], model?: string) => Promise<void>;
  /** Send a message via REST (non-streaming fallback). */
  sendMessageRest: (content: string) => Promise<void>;
  /** Delete a session (local-only for now, can be extended). */
  deleteSession: (sessionId: string) => void;
  /** Submit feedback for a message. */
  submitFeedback: (
    messageId: string,
    rating: "positive" | "negative",
    comment?: string
  ) => Promise<void>;
  /** Initialize WebSocket callbacks. Must be called once on mount. */
  initWebSocket: () => void;
  /** Disconnect WebSocket. Call on unmount. */
  disconnectWebSocket: () => void;
  /** Set the auth token for chat service. */
  setAuthToken: (token: string | null) => void;
}

// ─── Convert mock data.json to session format ───

function mockToSessions(): ChatSession[] {
  return mockConversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    lastMessage: conv.lastMessage,
    updatedAt: new Date(),
    messageCount: conv.messages.length,
    category: conv.category,
  }));
}

function mockToMessages(
  conv: (typeof mockConversations)[number]
): ChatMessage[] {
  return conv.messages.map((msg) => ({
    id: String(msg.id),
    role: msg.role as "user" | "assistant",
    content: msg.content,
    timestamp: new Date(),
  }));
}

function apiMessageToLocal(msg: ChatMessageResponse): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
    skill_used: msg.skill_used,
    sources: msg.sources,
  };
}

function apiSessionToLocal(s: ChatSessionSummary): ChatSession {
  return {
    id: s.id,
    title: s.title || "Untitled",
    lastMessage: "",
    updatedAt: s.last_message_at ? new Date(s.last_message_at) : new Date(),
    messageCount: s.message_count,
  };
}

// ─── Store ───

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentSessionId: null,
  sessions: mockToSessions(),
  isStreaming: false,
  isLoading: false,
  backendAvailable: false,
  inputDraft: "",
  streamingContent: "",
  activeSkill: null,
  isThinking: false,
  activeArtifact: null,
  artifacts: [],
  isArtifactStreaming: false,
  streamingArtifactContent: "",
  activeToolCalls: [],
  activeCodeExecution: null,

  // ─── Simple setters ───

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  setSessions: (sessions) => set({ sessions }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setInputDraft: (draft) => set({ inputDraft: draft }),

  setActiveSkill: (skill) => set({ activeSkill: skill }),

  setActiveArtifact: (artifact) => set({ activeArtifact: artifact }),

  clearMessages: () =>
    set({ messages: [], currentSessionId: null, streamingContent: "", activeSkill: null, isThinking: false, activeArtifact: null, artifacts: [], isArtifactStreaming: false, streamingArtifactContent: "", activeToolCalls: [], activeCodeExecution: null }),

  startNewSession: () =>
    set({
      messages: [],
      currentSessionId: null,
      inputDraft: "",
      streamingContent: "",
      activeSkill: null,
      isThinking: false,
      activeArtifact: null,
      artifacts: [],
      isArtifactStreaming: false,
      streamingArtifactContent: "",
      activeToolCalls: [],
      activeCodeExecution: null,
    }),

  appendStreamingContent: (chunk) =>
    set((state) => {
      const newContent = state.streamingContent + chunk;
      // Update the last assistant message in-place
      const updatedMessages = [...state.messages];
      const lastMsg = updatedMessages[updatedMessages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMsg,
          content: newContent,
        };
      }
      return { streamingContent: newContent, messages: updatedMessages };
    }),

  resetStreamingContent: () => set({ streamingContent: "" }),

  // ─── Backend-connected actions ───

  setAuthToken: (token) => {
    chatService.setToken(token);
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const response = await chatService.getSessions();
      const sessions = response.sessions.map(apiSessionToLocal);
      set({ sessions, backendAvailable: true, isLoading: false });
    } catch {
      // Backend not reachable — keep mock sessions
      set({ backendAvailable: false, isLoading: false });
    }
  },

  loadSessionMessages: async (sessionId: string) => {
    // Load directly from API — no need to wait for backendAvailable
    set({ isLoading: true });
    try {
      const response = await chatService.getSessionMessages(sessionId);
      const messages = response.messages.map(apiMessageToLocal);

      // Extract artifacts from message responses
      const loadedArtifacts: Artifact[] = [];
      for (const msg of response.messages) {
        if (msg.artifacts && msg.artifacts.length > 0) {
          for (const a of msg.artifacts) {
            loadedArtifacts.push({
              id: a.id,
              title: a.title,
              type: a.artifact_type,
              language: a.language ?? undefined,
              content: a.content,
              messageId: msg.id,
            });
          }
        }
      }

      set({
        messages,
        currentSessionId: sessionId,
        backendAvailable: true,
        isLoading: false,
        artifacts: loadedArtifacts,
        activeArtifact: loadedArtifacts.length > 0
          ? loadedArtifacts[loadedArtifacts.length - 1]
          : null,
      });
      return;
    } catch {
      // Fall through to mock
    }

    // Fallback: load from mock data
    const mockConv = mockConversations.find((c) => c.id === sessionId);
    if (mockConv) {
      set({
        messages: mockToMessages(mockConv),
        currentSessionId: sessionId,
        isLoading: false,
        artifacts: [],
        activeArtifact: null,
      });
    } else {
      set({ messages: [], currentSessionId: sessionId, isLoading: false, artifacts: [], activeArtifact: null });
    }
  },

  sendMessage: async (content: string, files?: File[], model?: string) => {
    const state = get();

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
      files,
    };
    set((s) => ({
      messages: [...s.messages, userMessage],
      isStreaming: true,
      isThinking: true,
      streamingContent: "",
      activeSkill: null,
      activeToolCalls: [],
    }));

    // Add placeholder assistant message for streaming
    const assistantPlaceholder: ChatMessage = {
      id: `streaming-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    set((s) => ({
      messages: [...s.messages, assistantPlaceholder],
    }));

    // Try WebSocket streaming
    try {
      await chatService.sendMessageStream(content, state.currentSessionId ?? undefined, model);
    } catch {
      // WebSocket failed — fall back to REST
      set((s) => {
        // Remove the empty assistant placeholder
        const msgs = s.messages.filter(
          (m) => m.id !== assistantPlaceholder.id
        );
        return { messages: msgs, isStreaming: false };
      });

      // Try REST fallback
      await get().sendMessageRest(content);
    }
  },

  sendMessageRest: async (content: string) => {
    const state = get();
    set({ isLoading: true });

    try {
      const response = await chatService.sendMessage(
        content,
        state.currentSessionId ?? undefined
      );
      const assistantMessage: ChatMessage = {
        id: response.id,
        role: "assistant",
        content: response.content,
        timestamp: response.created_at
          ? new Date(response.created_at)
          : new Date(),
        skill_used: response.skill_used,
        sources: response.sources,
      };

      set((s) => ({
        messages: [...s.messages, assistantMessage],
        currentSessionId: response.session_id,
        isLoading: false,
      }));
    } catch {
      // Backend not reachable — use mock response
      const mockResponse: ChatMessage = {
        id: `mock-${Date.now()}`,
        role: "assistant",
        content:
          "Ich kann gerade keine Verbindung zum Backend herstellen. Bitte versuche es spaeter erneut.",
        timestamp: new Date(),
      };
      set((s) => ({
        messages: [...s.messages, mockResponse],
        isLoading: false,
        backendAvailable: false,
      }));
    }
  },

  deleteSession: (sessionId: string) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      ...(state.currentSessionId === sessionId
        ? { currentSessionId: null, messages: [] }
        : {}),
    }));
  },

  submitFeedback: async (messageId, rating, comment) => {
    try {
      await chatService.submitFeedback(messageId, rating, comment);
    } catch {
      // Silently fail — feedback is non-critical
    }
  },

  initWebSocket: () => {
    chatService.setStreamCallbacks({
      onChunk: (data) => {
        const state = get();
        // Update session ID if this is the first chunk (new session created server-side)
        if (!state.currentSessionId && data.session_id) {
          set({ currentSessionId: data.session_id });
        }
        // First chunk means thinking is done
        if (state.isThinking) {
          set({ isThinking: false });
        }
        get().appendStreamingContent(data.content);
      },
      onSkillUsed: (data) => {
        set({ activeSkill: data.skill });
      },
      onThinking: () => {
        set({ isThinking: true });
      },
      onArtifact: (data) => {
        const state = get();
        if (state.isArtifactStreaming && state.activeArtifact) {
          // Update metadata on streaming artifact (from artifact_meta)
          set((s) => ({
            activeArtifact: s.activeArtifact
              ? {
                  ...s.activeArtifact,
                  title: data.title || s.activeArtifact.title,
                  type: data.artifact_type || s.activeArtifact.type,
                  language: data.language,
                  messageId: data.message_id,
                }
              : null,
          }));
        } else {
          // Non-streaming fallback (old "artifact" message type)
          const artifact: Artifact = {
            id: `artifact-${Date.now()}`,
            title: data.title,
            type: data.artifact_type,
            language: data.language,
            content: data.content,
            messageId: data.message_id,
          };
          set((s) => ({
            activeArtifact: artifact,
            artifacts: [...s.artifacts, artifact],
            isThinking: false,
          }));
        }
      },
      onArtifactStart: () => {
        const placeholder: Artifact = {
          id: `artifact-streaming-${Date.now()}`,
          title: "Generiere...",
          type: "code",
          content: "",
          messageId: "",
        };
        set({
          activeArtifact: placeholder,
          isArtifactStreaming: true,
          streamingArtifactContent: "",
          isThinking: false,
        });
      },
      onArtifactChunk: (data) => {
        set((s) => {
          const newContent = s.streamingArtifactContent + data.content;
          const updatedArtifact = s.activeArtifact
            ? { ...s.activeArtifact, content: newContent }
            : null;
          return {
            streamingArtifactContent: newContent,
            activeArtifact: updatedArtifact,
          };
        });
      },
      onArtifactEnd: (data) => {
        const artifact: Artifact = {
          id: `artifact-${Date.now()}`,
          title: data.title,
          type: data.artifact_type,
          language: data.language,
          content: data.content,
          messageId: data.message_id,
        };
        set((s) => ({
          activeArtifact: artifact,
          artifacts: [...s.artifacts, artifact],
          isArtifactStreaming: false,
          streamingArtifactContent: "",
          isThinking: false,
        }));
      },
      onToolUseStart: (data) => {
        set((s) => ({
          isThinking: false,
          activeToolCalls: [...s.activeToolCalls, {
            id: data.tool_id,
            name: data.tool_name,
            status: "running" as const,
          }],
        }));
      },
      onToolUseInput: (data) => {
        set((s) => ({
          activeToolCalls: s.activeToolCalls.map((tc) =>
            tc.id === data.tool_id ? { ...tc, input: data.input } : tc
          ),
        }));
      },
      onToolUseResult: (data) => {
        set((s) => ({
          activeToolCalls: s.activeToolCalls.map((tc) =>
            tc.id === data.tool_id
              ? { ...tc, result: data.result, success: data.success, status: data.success ? "completed" as const : "error" as const }
              : tc
          ),
        }));
      },
      onCodeExecutionStart: (data) => {
        set({
          activeCodeExecution: {
            language: data.language,
            code: data.code,
            status: "running",
          },
        });
      },
      onCodeExecutionResult: (data) => {
        set({
          activeCodeExecution: {
            language: data.language,
            code: "",
            stdout: data.stdout,
            stderr: data.stderr,
            exit_code: data.exit_code,
            timed_out: data.timed_out,
            duration_ms: data.duration_ms,
            status: data.timed_out ? "timeout" : data.exit_code === 0 ? "completed" : "error",
          },
        });
      },
      onEnd: (data) => {
        const state = get();
        // Finalize the streaming message with the real ID from backend
        const updatedMessages = [...state.messages];
        const lastMsg = updatedMessages[updatedMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMsg,
            id: data.message_id,
            skill_used: data.skill_used,
            sources: data.sources,
          };
        }
        set({
          messages: updatedMessages,
          isStreaming: false,
          isThinking: false,
          streamingContent: "",
          activeSkill: null,
          activeToolCalls: [],
          activeCodeExecution: null,
        });
        // Refresh sessions list so sidebar shows updated titles
        get().loadSessions();
      },
      onError: (data) => {
        console.error("[ChatWS] Error:", data.message, data.code);
        set({ isStreaming: false, isThinking: false, streamingContent: "", activeSkill: null, activeToolCalls: [], activeCodeExecution: null });

        // Add error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Fehler: ${data.message}`,
          timestamp: new Date(),
        };
        set((s) => {
          // Remove placeholder if it's still empty
          const msgs = s.messages.filter(
            (m) => !(m.role === "assistant" && m.content === "")
          );
          return { messages: [...msgs, errorMessage] };
        });
      },
      onDisconnect: () => {
        const state = get();
        if (state.isStreaming) {
          set({ isStreaming: false });
        }
      },
    });
  },

  disconnectWebSocket: () => {
    chatService.disconnect();
  },
}));
