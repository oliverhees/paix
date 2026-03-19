"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowUpIcon,
  BrainIcon,
  DribbbleIcon,
  GlobeIcon,
  MicIcon,
  Paperclip,
  SquareIcon,
  Terminal,
  ThumbsDownIcon,
  ThumbsUpIcon,
  X
} from "lucide-react";
import { CodeIcon, CopyIcon } from "@radix-ui/react-icons";
import Lottie from "lottie-react";

import {
  Input,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea
} from "@/components/ui/custom/prompt/input";
import { Button } from "@/components/ui/button";
import { Suggestion } from "@/components/ui/custom/prompt/suggestion";
import { ChatContainer } from "@/components/ui/custom/prompt/chat-container";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent
} from "@/components/ui/custom/prompt/message";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
import { PromptLoader } from "@/components/ui/custom/prompt/loader";
import { PromptScrollButton } from "@/components/ui/custom/prompt/scroll-button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { AIUpgradePricingModal } from "./ai-upgrade-modal";
import { useChatStore } from "@/lib/stores/chat-store";

import aiSphereAnimation from "../ai-sphere-animation.json";

// ─── Tool Name Formatting ────────────────────────────────────────────────────

/**
 * Format raw tool names into human-readable German labels.
 * Examples:
 *   mcp__ghost-cms__posts_add      → "Ghost CMS: Artikel erstellen"
 *   mcp__linear__create_issue      → "Linear: Issue erstellen"
 *   api__weather__get_forecast     → "Weather: Vorhersage abrufen"
 *   web_fetch                      → "Webseite abrufen"
 *   run_code                       → "Code ausfuehren"
 *   create_artifact                → "Artefakt erstellen"
 *   storage_write                  → "Datei speichern"
 *   storage_read                   → "Datei lesen"
 *   storage_list                   → "Dateien auflisten"
 */
const TOOL_LABELS: Record<string, string> = {
  web_fetch: "Webseite abrufen",
  run_code: "Code ausfuehren",
  create_artifact: "Artefakt erstellen",
  storage_write: "Datei speichern",
  storage_read: "Datei lesen",
  storage_list: "Dateien auflisten",
  storage_delete: "Datei loeschen",
};

const ACTION_LABELS: Record<string, string> = {
  add: "erstellen",
  create: "erstellen",
  get: "abrufen",
  list: "auflisten",
  search: "suchen",
  update: "aktualisieren",
  delete: "loeschen",
  remove: "entfernen",
  send: "senden",
  read: "lesen",
  write: "schreiben",
  fetch: "abrufen",
  browse: "durchsuchen",
  edit: "bearbeiten",
  post: "senden",
  put: "aktualisieren",
  find: "finden",
  query: "abfragen",
  execute: "ausfuehren",
  run: "ausfuehren",
  upload: "hochladen",
  download: "herunterladen",
};

function formatToolName(rawName: string): string {
  // Check static labels first
  if (TOOL_LABELS[rawName]) return TOOL_LABELS[rawName];

  // MCP tools: mcp__server-name__tool_action
  const mcpMatch = rawName.match(/^mcp__([^_]+(?:[_-][^_]+)*)__(.+)$/);
  if (mcpMatch) {
    const server = mcpMatch[1]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const action = mcpMatch[2].replace(/_/g, " ");
    // Try to translate the last word
    const parts = action.split(" ");
    const lastPart = parts[parts.length - 1].toLowerCase();
    if (ACTION_LABELS[lastPart]) {
      parts[parts.length - 1] = ACTION_LABELS[lastPart];
    }
    return `${server}: ${parts.join(" ")}`;
  }

  // API tools: api__service__action
  const apiMatch = rawName.match(/^api__([^_]+(?:[_-][^_]+)*)__(.+)$/);
  if (apiMatch) {
    const service = apiMatch[1]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const action = apiMatch[2].replace(/_/g, " ");
    const parts = action.split(" ");
    const lastPart = parts[parts.length - 1].toLowerCase();
    if (ACTION_LABELS[lastPart]) {
      parts[parts.length - 1] = ACTION_LABELS[lastPart];
    }
    return `${service}: ${parts.join(" ")}`;
  }

  // Skill tools: skill_name format
  return rawName
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Model Selector ──────────────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
  context: number;
}

type ModelsMap = Record<string, ModelInfo[]>;

const FALLBACK_MODELS: ModelsMap = {
  anthropic: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", context: 200000 },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", context: 200000 },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", context: 200000 },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", context: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", context: 128000 },
    { id: "o3-mini", name: "o3 Mini", context: 200000 },
  ],
  google: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: 1000000 },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", context: 1000000 },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", context: 2000000 },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

function formatContextSize(ctx: number): string {
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(ctx % 1000000 === 0 ? 0 : 1)}M`;
  return `${Math.round(ctx / 1000)}K`;
}

function useAvailableModels(): ModelsMap {
  const [models, setModels] = useState<ModelsMap>(FALLBACK_MODELS);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ModelsMap>("/chat/models")
      .then((data) => {
        if (!cancelled && data && Object.keys(data).length > 0) {
          setModels(data);
        }
      })
      .catch(() => {
        // API not available yet — keep fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return models;
}

export default function AIChatInterface() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const availableModels = useAvailableModels();

  const [isFirstResponse, setIsFirstResponse] = useState(false); // Understanding whether the conversation has started or not

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  // ─── Zustand Store ───
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeSkill = useChatStore((s) => s.activeSkill);
  const isThinking = useChatStore((s) => s.isThinking);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const loadSessionMessages = useChatStore((s) => s.loadSessionMessages);
  const initWebSocket = useChatStore((s) => s.initWebSocket);
  const disconnectWebSocket = useChatStore((s) => s.disconnectWebSocket);
  const submitFeedback = useChatStore((s) => s.submitFeedback);
  const artifacts = useChatStore((s) => s.artifacts);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  const activeArtifact = useChatStore((s) => s.activeArtifact);
  const activeToolCalls = useChatStore((s) => s.activeToolCalls);
  const activeCodeExecution = useChatStore((s) => s.activeCodeExecution);

  // Initialize WebSocket callbacks once on mount
  useEffect(() => {
    initWebSocket();
    return () => {
      disconnectWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load session messages when navigating to a session via URL
  useEffect(() => {
    if (params.id) {
      loadSessionMessages(params.id);
      setIsFirstResponse(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Pre-fill prompt from URL context parameter (e.g. from skill history)
  useEffect(() => {
    const context = searchParams.get("context");
    if (context) {
      setPrompt(context);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const streamResponse = async () => {
    if (isStreaming) return;

    if (prompt.trim() || files.length > 0) {
      setIsFirstResponse(true);

      const messageContent = prompt;
      const messageFiles = files;

      setPrompt("");
      setFiles([]);

      await sendMessage(messageContent, messageFiles.length > 0 ? messageFiles : undefined, selectedModel);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = "";
    }
  };

  const FileListItem = ({
    file,
    dismiss = true,
    index
  }: {
    file: File;
    dismiss?: boolean;
    index: number;
  }) => (
    <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <Paperclip className="size-4" />
      <span className="max-w-[120px] truncate">{file.name}</span>
      {dismiss && (
        <button
          onClick={() => handleRemoveFile(index)}
          className="hover:bg-secondary/50 rounded-full p-1">
          <X className="size-4" />
        </button>
      )}
    </div>
  );

  const activeCategoryData = suggestionGroups.find((group) => group.label === activeCategory);

  const showCategorySuggestions = activeCategory !== "";

  return (
    <div className={cn("mx-auto flex h-full w-full flex-col items-center justify-center space-y-4 lg:p-4", activeArtifact ? "max-w-3xl" : "max-w-4xl")}>
      <ChatContainer
        className={cn("relative w-full flex-1 space-y-4 pe-2 pt-10 md:pt-0", {
          hidden: !isFirstResponse
        })}
        ref={containerRef}
        scrollToRef={bottomRef}>
        {messages.map((message, index) => {
          const isAssistant = message.role === "assistant";
          const isLastMessage = index === messages.length - 1;

          return (
            <Message
              key={message.id}
              className={message.role === "user" ? "justify-end" : "justify-start"}>
              <div
                className={cn("max-w-[85%] flex-1 sm:max-w-[75%]", {
                  "justify-end text-end": !isAssistant
                })}>
                {isAssistant ? (
                  <div className="space-y-2">
                    {message.skill_used && (
                      <div className="flex items-center gap-1.5 text-xs text-purple-400">
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4m0 12v4m-8-10H2m20 0h-2m-2.93-6.07l-1.41 1.41M7.76 16.24l-1.41 1.41m0-11.31l1.41 1.41m8.48 8.48l1.41 1.41" />
                        </svg>
                        <span>Skill verwendet: {message.skill_used}</span>
                      </div>
                    )}
                    {artifacts
                      .filter((a) => a.messageId === message.id)
                      .map((artifact) => (
                        <button
                          key={artifact.id}
                          onClick={() => setActiveArtifact(artifact)}
                          className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-sm text-orange-400 transition-colors hover:bg-orange-500/10 cursor-pointer"
                        >
                          <CodeIcon className="size-4" />
                          <span>{artifact.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Klicken zum Oeffnen
                          </span>
                        </button>
                      ))}
                    <div className="bg-muted text-foreground prose rounded-lg border p-4">
                      <Markdown className={"space-y-4"}>{message.content}</Markdown>
                    </div>
                    <MessageActions
                      className={cn(
                        "flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                        isLastMessage && "opacity-100"
                      )}>
                      <MessageAction tooltip="Copy" delayDuration={100}>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <CopyIcon />
                        </Button>
                      </MessageAction>
                      <MessageAction tooltip="Upvote" delayDuration={100}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full"
                          onClick={() => submitFeedback(String(message.id), "positive")}>
                          <ThumbsUpIcon />
                        </Button>
                      </MessageAction>
                      <MessageAction tooltip="Downvote" delayDuration={100}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full"
                          onClick={() => submitFeedback(String(message.id), "negative")}>
                          <ThumbsDownIcon />
                        </Button>
                      </MessageAction>
                    </MessageActions>
                  </div>
                ) : message?.files && message.files.length > 0 ? (
                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      {message.files.map((file, index) => (
                        <FileListItem key={index} index={index} file={file} dismiss={false} />
                      ))}
                    </div>
                    {message.content ? (
                      <>
                        <MessageContent className="bg-primary text-primary-foreground inline-flex">
                          {message.content}
                        </MessageContent>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <MessageContent className="bg-primary text-primary-foreground inline-flex text-start">
                    {message.content}
                  </MessageContent>
                )}
              </div>
            </Message>
          );
        })}

        {isStreaming && (
          <div className="ps-2 space-y-2">
            {/* Code Execution Card */}
            {activeCodeExecution && (
              <div className={cn(
                "rounded-lg border p-3 text-sm font-mono",
                activeCodeExecution.status === "running"
                  ? "border-orange-500/20 bg-orange-500/5"
                  : activeCodeExecution.status === "completed"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-red-500/20 bg-red-500/5"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className={cn(
                    "size-4",
                    activeCodeExecution.status === "running" ? "text-orange-400 animate-pulse" :
                    activeCodeExecution.status === "completed" ? "text-emerald-400" : "text-red-400"
                  )} />
                  <span className={cn(
                    "text-xs font-sans font-medium",
                    activeCodeExecution.status === "running" ? "text-orange-400" :
                    activeCodeExecution.status === "completed" ? "text-emerald-400" : "text-red-400"
                  )}>
                    {activeCodeExecution.status === "running"
                      ? `Fuehre ${activeCodeExecution.language} Code aus...`
                      : activeCodeExecution.status === "completed"
                      ? `${activeCodeExecution.language} — ${activeCodeExecution.duration_ms}ms`
                      : activeCodeExecution.timed_out
                      ? `${activeCodeExecution.language} — Timeout`
                      : `${activeCodeExecution.language} — Exit ${activeCodeExecution.exit_code}`
                    }
                  </span>
                </div>
                {activeCodeExecution.stdout && (
                  <div className="mt-1">
                    <div className="text-xs text-muted-foreground font-sans mb-0.5">Output:</div>
                    <pre className="text-xs text-emerald-300 bg-black/30 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {activeCodeExecution.stdout.length > 500
                        ? activeCodeExecution.stdout.slice(0, 500) + "..."
                        : activeCodeExecution.stdout}
                    </pre>
                  </div>
                )}
                {activeCodeExecution.stderr && (
                  <div className="mt-1">
                    <div className="text-xs text-muted-foreground font-sans mb-0.5">Errors:</div>
                    <pre className="text-xs text-red-300 bg-black/30 rounded p-2 overflow-x-auto max-h-20 overflow-y-auto whitespace-pre-wrap">
                      {activeCodeExecution.stderr.length > 300
                        ? activeCodeExecution.stderr.slice(0, 300) + "..."
                        : activeCodeExecution.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Tool Call Cards */}
            {activeToolCalls.length > 0 && (
              <div className="space-y-1.5">
                {activeToolCalls.map((tc) => (
                  <div
                    key={tc.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      tc.status === "running"
                        ? "border-orange-500/20 bg-orange-500/5"
                        : tc.status === "completed"
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-red-500/20 bg-red-500/5"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {tc.status === "running" ? (
                          <svg className="size-3.5 animate-spin text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4m0 12v4m-8-10H2m20 0h-2m-2.93-6.07l-1.41 1.41M7.76 16.24l-1.41 1.41m0-11.31l1.41 1.41m8.48 8.48l1.41 1.41" />
                          </svg>
                        ) : tc.status === "completed" ? (
                          <svg className="size-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg className="size-3.5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        )}
                        <span className={cn(
                          "font-medium",
                          tc.status === "running" ? "text-orange-400" :
                          tc.status === "completed" ? "text-emerald-400" : "text-red-400"
                        )}>
                          {formatToolName(tc.name)}
                        </span>
                      </div>
                      {tc.input && Object.keys(tc.input).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                          {Object.entries(tc.input).map(([k, v]) => (
                            <span key={k} className="mr-2">
                              {k}: {typeof v === 'string' ? (v.length > 50 ? v.slice(0, 50) + '...' : v) : JSON.stringify(v)}
                            </span>
                          ))}
                        </div>
                      )}
                      {tc.result && (
                        <div className={cn(
                          "mt-1 text-xs truncate",
                          tc.success ? "text-emerald-400/70" : "text-red-400/70"
                        )}>
                          {tc.result.length > 100 ? tc.result.slice(0, 100) + '...' : tc.result}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Existing indicators */}
            {activeSkill ? (
              <div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-purple-400">
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-8-10H2m20 0h-2m-2.93-6.07l-1.41 1.41M7.76 16.24l-1.41 1.41m0-11.31l1.41 1.41m8.48 8.48l1.41 1.41" />
                  </svg>
                  <span className="font-medium">Nutze Skill:</span>
                  <span className="text-purple-300">{activeSkill}</span>
                </div>
                <PromptLoader variant="pulse-dot" />
              </div>
            ) : isThinking ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-amber-400">
                  <svg className="size-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span className="font-medium">Denkt nach...</span>
                </div>
                <PromptLoader variant="pulse-dot" />
              </div>
            ) : (
              <PromptLoader variant="pulse-dot" />
            )}
          </div>
        )}
      </ChatContainer>

      <div className="fixed right-4 bottom-4">
        <PromptScrollButton
          containerRef={containerRef}
          scrollRef={bottomRef}
          className="shadow-sm"
        />
      </div>

      {/* Welcome message */}
      {!isFirstResponse && (
        <div className="mb-10">
          <div className="mx-auto -mt-36 hidden w-72 mask-b-from-100% mask-radial-[50%_50%] mask-radial-from-0% md:block">
            <Lottie className="w-full" animationData={aiSphereAnimation} loop autoplay />
          </div>

          <h1 className="text-center text-2xl leading-normal font-medium lg:text-4xl">
            Hallo! <br /> Wie kann ich dir{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              heute helfen?
            </span>
          </h1>
        </div>
      )}
      {/* Welcome message */}

      <div className="bg-primary/10 w-full rounded-2xl p-1 pt-0">
        <div className="flex gap-2 px-4 py-2 text-xs">
          Use our faster AI on Pro Plan <span>&bull;</span>{" "}
          <AIUpgradePricingModal>
            <Link href="#" className="hover:underline">
              Upgrade
            </Link>
          </AIUpgradePricingModal>
        </div>
        <Input
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={streamResponse}
          className="w-full overflow-hidden border-0 p-0 shadow-none">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {files.map((file, index) => (
                <FileListItem key={index} index={index} file={file} />
              ))}
            </div>
          )}

          <PromptInputTextarea placeholder="Frag mich etwas..." className="min-h-auto p-4" />

          <PromptInputActions className="flex items-center justify-between gap-2 p-3">
            <div className="flex items-center gap-2">
              <PromptInputAction tooltip="Attach files">
                <label
                  htmlFor="file-upload"
                  className="hover:bg-secondary-foreground/10 flex size-8 cursor-pointer items-center justify-center rounded-2xl">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <Paperclip className="text-primary size-5" />
                </label>
              </PromptInputAction>

              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="rounded-full focus:ring-0!" size="sm">
                  <GlobeIcon />
                  <div className="hidden lg:flex">
                    <SelectValue placeholder="Modell waehlen" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableModels).map(([provider, providerModels]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {PROVIDER_LABELS[provider] ?? provider}
                      </SelectLabel>
                      {providerModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({formatContextSize(m.context)})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <PromptInputAction tooltip="Voice input">
                <Button variant="outline" size="icon" className="size-9 rounded-full">
                  <MicIcon size={18} />
                </Button>
              </PromptInputAction>
              <PromptInputAction tooltip={isStreaming ? "Stop generation" : "Send message"}>
                <Button
                  variant="default"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={streamResponse}
                  disabled={!prompt.trim()}>
                  {isStreaming ? <SquareIcon /> : <ArrowUpIcon />}
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </Input>
      </div>

      {!isFirstResponse && (
        <div className="relative flex w-full flex-col items-center justify-center space-y-2">
          <div className="absolute top-0 left-0 h-[70px] w-full">
            {showCategorySuggestions ? (
              <div className="flex w-full flex-col space-y-1">
                {activeCategoryData?.items.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    highlight={activeCategoryData.highlight}
                    onClick={() => {
                      setPrompt(suggestion);
                      setActiveCategory("");
                      // Optional: auto-send
                      // handleSend()
                    }}>
                    {suggestion}
                  </Suggestion>
                ))}
              </div>
            ) : (
              <div className="relative flex w-full flex-wrap items-stretch justify-start gap-2">
                {suggestionGroups.map((suggestion) => (
                  <Suggestion
                    key={suggestion.label}
                    size="sm"
                    onClick={() => {
                      setActiveCategory(suggestion.label);
                      setPrompt(""); // Clear input when selecting a category
                    }}
                    className="capitalize">
                    {suggestion.icon && <suggestion.icon />}
                    {suggestion.label}
                  </Suggestion>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const suggestionGroups = [
  {
    icon: BrainIcon,
    label: "Summary",
    highlight: "Summarize",
    items: ["Summarize a document", "Summarize a video", "Summarize a podcast", "Summarize a book"]
  },
  {
    icon: CodeIcon,
    label: "Code",
    highlight: "Help me",
    items: [
      "Help me write React components",
      "Help me debug code",
      "Help me learn Python",
      "Help me learn SQL"
    ]
  },
  {
    icon: DribbbleIcon,
    label: "Design",
    highlight: "Design",
    items: [
      "Design a small logo",
      "Design a hero section",
      "Design a landing page",
      "Design a social media post"
    ]
  },
  {
    icon: GlobeIcon,
    label: "Research",
    highlight: "Research",
    items: [
      "Research the best practices for SEO",
      "Research the best running shoes",
      "Research the best restaurants in Paris",
      "Research the best AI tools"
    ]
  }
];
