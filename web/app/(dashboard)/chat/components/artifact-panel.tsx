"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  XIcon,
  CopyIcon,
  DownloadIcon,
  CodeIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  GitBranchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
import {
  CodeBlock,
  CodeBlockCode,
} from "@/components/ui/custom/prompt/code-block";
import { useChatStore, type Artifact } from "@/lib/stores/chat-store";

const TYPE_META: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  code: { icon: CodeIcon, label: "Code", color: "text-blue-400" },
  markdown: {
    icon: FileTextIcon,
    label: "Dokument",
    color: "text-green-400",
  },
  html: { icon: GlobeIcon, label: "HTML", color: "text-orange-400" },
  mermaid: {
    icon: GitBranchIcon,
    label: "Diagramm",
    color: "text-purple-400",
  },
  svg: { icon: ImageIcon, label: "SVG", color: "text-pink-400" },
};

function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "code":
      return (
        <div className="h-full overflow-auto p-4">
          <CodeBlock>
            <CodeBlockCode
              code={artifact.content}
              language={artifact.language || "plaintext"}
            />
          </CodeBlock>
        </div>
      );

    case "markdown":
      return (
        <div className="prose prose-invert max-w-none overflow-auto p-6">
          <Markdown>{artifact.content}</Markdown>
        </div>
      );

    case "html":
      return (
        <iframe
          srcDoc={artifact.content}
          sandbox="allow-scripts allow-same-origin"
          className="h-full w-full border-0 bg-white"
          title={artifact.title}
        />
      );

    case "svg":
      return (
        <div
          className="flex h-full items-center justify-center overflow-auto p-6"
          dangerouslySetInnerHTML={{ __html: artifact.content }}
        />
      );

    case "mermaid":
      return (
        <div className="h-full overflow-auto p-4">
          <CodeBlock>
            <CodeBlockCode code={artifact.content} language="mermaid" />
          </CodeBlock>
        </div>
      );

    default:
      return (
        <div className="overflow-auto p-6">
          <pre className="whitespace-pre-wrap text-sm">{artifact.content}</pre>
        </div>
      );
  }
}

export default function ArtifactPanel() {
  const activeArtifact = useChatStore((s) => s.activeArtifact);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  const isArtifactStreaming = useChatStore((s) => s.isArtifactStreaming);
  const [panelWidth, setPanelWidth] = useState(55);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;
      const vw = window.innerWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        const deltaX = startX - moveEvent.clientX;
        const deltaPercent = (deltaX / vw) * 100;
        const newWidth = Math.min(75, Math.max(30, startWidth + deltaPercent));
        setPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth]
  );

  if (!activeArtifact) return null;

  const meta = TYPE_META[activeArtifact.type] || TYPE_META.code;
  const Icon = meta.icon;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeArtifact.content);
  };

  const handleDownload = () => {
    const extensions: Record<string, string> = {
      code: activeArtifact.language || "txt",
      markdown: "md",
      html: "html",
      mermaid: "mmd",
      svg: "svg",
    };
    const ext = extensions[activeArtifact.type] || "txt";
    const blob = new Blob([activeArtifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeArtifact.title.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Drag handle */}
      <div
        className="hidden lg:flex w-1.5 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="h-8 w-0.5 rounded-full bg-border" />
      </div>
      {/* Panel */}
      <div
        className="hidden lg:flex h-full flex-col bg-background"
        style={{ width: `${panelWidth}%`, minWidth: "350px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <Icon className={cn("size-4 shrink-0", meta.color)} />
            <span className="truncate font-medium text-sm">
              {activeArtifact.title}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs",
                meta.color
              )}
            >
              {meta.label}
            </span>
            {activeArtifact.language && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {activeArtifact.language}
              </span>
            )}
            {isArtifactStreaming && (
              <span className="ml-auto shrink-0 text-xs text-emerald-400 animate-pulse">
                Wird generiert...
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleCopy}
              title="Kopieren"
            >
              <CopyIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleDownload}
              title="Herunterladen"
            >
              <DownloadIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setActiveArtifact(null)}
              title="Schliessen"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ArtifactRenderer artifact={activeArtifact} />
        </div>
      </div>
    </>
  );
}
