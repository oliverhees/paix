"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FolderOpen,
  File,
  Upload,
  Trash2,
  Download,
  FolderPlus,
  ChevronRight,
  Home,
  Loader2,
  HardDrive,
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
  MoreVertical,
  MoveRight,
  RefreshCw,
  AlertCircle,
  Info,
  X,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  storageService,
  type StorageItem,
  type StorageStatus,
  type StorageStats,
} from "@/lib/storage-service";

// ─── Helpers ──

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "ico", "bmp"].includes(ext))
    return FileImage;
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return FileVideo;
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return FileAudio;
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext))
    return FileArchive;
  if (
    ["js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "cpp", "c", "h", "css", "html", "json", "yaml", "yml", "toml", "xml", "sh", "sql"].includes(ext)
  )
    return FileCode;
  if (["md", "txt", "log", "csv", "pdf", "doc", "docx", "xls", "xlsx"].includes(ext))
    return FileText;
  return File;
}

const PREVIEWABLE_EXTENSIONS = ["md", "txt", "json", "csv", "log", "yaml", "yml", "toml", "xml", "sh", "sql", "py", "js", "ts", "tsx", "jsx", "css", "html"];

function isPreviewable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return PREVIEWABLE_EXTENSIONS.includes(ext);
}

// ─── Breadcrumb ──

function PathBreadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm overflow-x-auto">
      <button
        onClick={() => onNavigate("")}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <Home className="size-3.5" />
        <span>Dateien</span>
      </button>
      {parts.map((part, i) => {
        const fullPath = parts.slice(0, i + 1).join("/") + "/";
        const isLast = i === parts.length - 1;
        return (
          <div key={fullPath} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="size-3 text-muted-foreground" />
            <button
              onClick={() => onNavigate(fullPath)}
              className={`transition-colors ${
                isLast
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {part}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Drop Zone ──

function DropZone({
  currentPath,
  onUpload,
  uploading,
}: {
  currentPath: string;
  onUpload: (files: FileList) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(e.target.files);
            e.target.value = "";
          }
        }}
      />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <Loader2 className="size-8 text-primary animate-spin" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            {uploading ? "Wird hochgeladen..." : "Dateien hierher ziehen"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            oder{" "}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-primary hover:underline"
              disabled={uploading}
            >
              Dateien auswählen
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── File/Folder Row ──

function ItemRow({
  item,
  onNavigate,
  onDelete,
  onDownload,
  onMove,
  onPreview,
}: {
  item: StorageItem;
  onNavigate: (path: string) => void;
  onDelete: (item: StorageItem) => void;
  onDownload: (item: StorageItem) => void;
  onMove: (item: StorageItem) => void;
  onPreview: (item: StorageItem) => void;
}) {
  const isFolder = item.type === "folder";
  const canPreview = !isFolder && isPreviewable(item.name);
  const Icon = isFolder ? FolderOpen : getFileIcon(item.name);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
        isFolder
          ? "hover:bg-muted/70 cursor-pointer"
          : canPreview
            ? "hover:bg-muted/50 cursor-pointer"
            : "hover:bg-muted/50"
      }`}
      onClick={
        isFolder
          ? () => onNavigate(item.path)
          : canPreview
            ? () => onPreview(item)
            : undefined
      }
    >
      <Icon
        className={`size-5 shrink-0 ${
          isFolder ? "text-amber-500" : "text-muted-foreground"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {!isFolder && (
          <p className="text-xs text-muted-foreground">
            {item.size !== undefined && formatFileSize(item.size)}
            {item.last_modified && ` — ${formatDate(item.last_modified)}`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}
          >
            <Eye className="size-3.5" />
          </Button>
        )}
        {!isFolder && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(item);
            }}
          >
            <Download className="size-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPreview && (
              <DropdownMenuItem onClick={() => onPreview(item)}>
                <Eye className="size-3.5 mr-2" />
                Vorschau
              </DropdownMenuItem>
            )}
            {!isFolder && (
              <DropdownMenuItem onClick={() => onDownload(item)}>
                <Download className="size-3.5 mr-2" />
                Herunterladen
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onMove(item)}>
              <MoveRight className="size-3.5 mr-2" />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(item)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Main Page ──

export default function DateienPage() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState<StorageItem[]>([]);
  const [files, setFiles] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renameItem, setRenameItem] = useState<StorageItem | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const s = await storageService.getStats();
      setStats(s);
    } catch {
      // Stats are non-critical, ignore errors
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await storageService.getStatus();
      setStatus(s);
    } catch {
      setStatus({ connected: false, error: "Verbindung fehlgeschlagen", endpoint: null, bucket: null });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storageService.listFiles(currentPath);
      setFolders(data.folders);
      setFiles(data.files);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Laden";
      if (!msg.includes("503")) toast.error(msg);
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // Load status + stats in parallel on mount
  useEffect(() => {
    Promise.all([fetchStatus(), fetchStats()]);
  }, [fetchStatus, fetchStats]);

  useEffect(() => {
    if (status?.connected) {
      fetchFiles();
    } else {
      setLoading(false);
    }
  }, [status?.connected, fetchFiles]);

  function navigateTo(path: string) {
    setCurrentPath(path);
  }

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    let success = 0;
    for (const file of Array.from(fileList)) {
      try {
        await storageService.uploadFile(file, currentPath);
        success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
        toast.error(`${file.name}: ${msg}`);
      }
    }
    if (success > 0) {
      toast.success(
        success === 1
          ? "Datei hochgeladen"
          : `${success} Dateien hochgeladen`
      );
      fetchFiles();
      fetchStats();
    }
    setUploading(false);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const path = currentPath + newFolderName.trim() + "/";
      await storageService.createFolder(path);
      toast.success(`Ordner "${newFolderName}" erstellt`);
      setNewFolderName("");
      setNewFolderOpen(false);
      fetchFiles();
      fetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Erstellen";
      toast.error(msg);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDelete(item: StorageItem) {
    const isFolder = item.type === "folder";
    try {
      await storageService.deleteObject(item.path, isFolder);
      toast.success(`${isFolder ? "Ordner" : "Datei"} gelöscht`);
      fetchFiles();
      fetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(msg);
    }
  }

  async function handleDownload(item: StorageItem) {
    try {
      const { url } = await storageService.getDownloadUrl(item.path);
      window.open(url, "_blank");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download fehlgeschlagen";
      toast.error(msg);
    }
  }

  async function handleRename() {
    if (!renameItem || !renameTo.trim()) return;
    const parentPath = renameItem.path.substring(
      0,
      renameItem.path.lastIndexOf(renameItem.name)
    );
    const newPath =
      renameItem.type === "folder"
        ? parentPath + renameTo.trim() + "/"
        : parentPath + renameTo.trim();

    try {
      await storageService.moveObject(renameItem.path, newPath);
      toast.success("Umbenannt");
      setRenameItem(null);
      setRenameTo("");
      fetchFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Umbenennen";
      toast.error(msg);
    }
  }

  async function handlePreview(item: StorageItem) {
    setPreviewItem(item);
    setPreviewContent("");
    setPreviewLoading(true);
    try {
      const text = await storageService.previewFile(item.path);
      setPreviewContent(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Vorschau fehlgeschlagen";
      setPreviewContent(`Fehler: ${msg}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Initial Loading (status check in progress) ──
  if (statusLoading && !status) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dateien</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hetzner Object Storage — Dateien, Projekte und Dokumente
          </p>
        </div>
        <div className="flex items-center gap-3 py-12 justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verbinde mit Object Storage...</span>
        </div>
      </div>
    );
  }

  // ── Not Configured ──
  if (status && !status.connected) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dateien</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hetzner Object Storage für Dateien, Projekte und Dokumente
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="size-5 text-amber-500" />
              Object Storage nicht verbunden
            </CardTitle>
            <CardDescription>
              {status.error || "Konfiguriere die S3-Zugangsdaten um den Dateispeicher zu aktivieren."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Setze folgende Umgebungsvariablen in der API <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> Datei:
            </p>
            <div className="rounded-lg bg-muted p-3 font-mono text-xs space-y-1">
              <p>S3_ENDPOINT_URL=https://fsn1.your-objectstorage.com</p>
              <p>S3_ACCESS_KEY=dein-access-key</p>
              <p>S3_SECRET_KEY=dein-secret-key</p>
              <p>S3_BUCKET_NAME=paix-files</p>
              <p>S3_REGION=fsn1</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Hetzner Object Storage ist S3-kompatibel. Erstelle einen Bucket
                und Access Keys in der{" "}
                <a
                  href="https://console.hetzner.cloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Hetzner Cloud Console
                </a>
                .
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main View ──
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dateien</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hetzner Object Storage — Dateien, Projekte und Dokumente
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFolderOpen(true)}
            className="gap-1.5"
          >
            <FolderPlus className="size-3.5" />
            Neuer Ordner
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFiles}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Storage info */}
      {status && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="size-3.5" />
          <span>{status.bucket}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Verbunden
          </span>
          {stats && (stats.files > 0 || stats.folders > 0) && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span>
                {stats.folders > 0 && `${stats.folders} Ordner`}
                {stats.folders > 0 && stats.files > 0 && " \u00b7 "}
                {stats.files > 0 && `${stats.files} Dateien`}
                {stats.total_size > 0 && ` \u00b7 ${formatFileSize(stats.total_size)} belegt`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      <PathBreadcrumb path={currentPath} onNavigate={navigateTo} />

      {/* Drop Zone */}
      <DropZone
        currentPath={currentPath}
        onUpload={handleUpload}
        uploading={uploading}
      />

      {/* File List */}
      {loading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Dateien werden geladen...</span>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="text-center py-12">
          <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-3">
            <FolderOpen className="size-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Dieser Ordner ist leer</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ziehe Dateien hierher oder erstelle einen Ordner
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {folders.map((folder) => (
            <ItemRow
              key={folder.path}
              item={folder}
              onNavigate={navigateTo}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onMove={(item) => {
                setRenameItem(item);
                setRenameTo(item.name);
              }}
            />
          ))}
          {files.map((file) => (
            <ItemRow
              key={file.path}
              item={file}
              onNavigate={navigateTo}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onMove={(item) => {
                setRenameItem(item);
                setRenameTo(item.name);
              }}
            />
          ))}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="size-5" />
              Neuer Ordner
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Ordnername"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName("");
                }}
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="gap-1.5"
              >
                {creatingFolder && <Loader2 className="size-3.5 animate-spin" />}
                Erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameItem(null);
            setRenameTo("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="size-5" />
              Umbenennen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Neuer Name"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenameItem(null);
                  setRenameTo("");
                }}
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleRename}
                disabled={!renameTo.trim()}
              >
                Umbenennen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewItem(null);
            setPreviewContent("");
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              {previewItem?.name}
            </DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Datei wird geladen...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[70vh]">
              <pre className="text-sm font-mono whitespace-pre-wrap break-all p-4 bg-muted rounded-lg">
                {previewContent}
              </pre>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewItem(null);
                setPreviewContent("");
              }}
            >
              Schließen
            </Button>
            {previewItem && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => handleDownload(previewItem)}
              >
                <Download className="size-3.5" />
                Herunterladen
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
