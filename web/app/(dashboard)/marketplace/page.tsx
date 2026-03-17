"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store,
  Search,
  Loader2,
  Download,
  Check,
  Star,
  Zap,
  Wrench,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";

// ── Types ──

interface MarketplaceItem {
  id: string;
  type: "skill" | "werkzeug";
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  author: string;
  version: string;
  install_count: number;
  featured: boolean;
  skill_md: string | null;
  address: string | null;
  requirements: Record<string, string> | null;
  hint: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MarketplaceResponse {
  items: MarketplaceItem[];
  total: number;
  categories: string[];
}

// ── Category label mapping ──

const CATEGORY_LABELS: Record<string, string> = {
  research: "Research",
  writing: "Schreiben",
  productivity: "Produktivität",
  communication: "Kommunikation",
  creativity: "Kreativität",
  content: "Content",
  development: "Entwicklung",
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Component ──

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installedSlugs, setInstalledSlugs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === "skills") params.set("type", "skill");
      if (activeTab === "werkzeuge") params.set("type", "werkzeug");
      if (activeTab === "featured") params.set("featured", "true");
      if (activeCategory) params.set("category", activeCategory);
      if (search.trim()) params.set("search", search.trim());

      const qs = params.toString();
      const data = await api.get<MarketplaceResponse>(
        `/marketplace${qs ? `?${qs}` : ""}`
      );
      setItems(data.items);
      setCategories(data.categories);
    } catch (err) {
      console.error("Failed to load marketplace:", err);
      toast.error("Marketplace konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCategory, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleInstall = async (item: MarketplaceItem) => {
    setInstalling(item.slug);
    try {
      await api.post(`/marketplace/${item.slug}/install`);
      setInstalledSlugs((prev) => new Set(prev).add(item.slug));
      toast.success(`${item.name} wurde installiert.`);
      // Refresh to update install counts
      fetchItems();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Installation fehlgeschlagen.";
      toast.error(message);
    } finally {
      setInstalling(null);
    }
  };

  const filteredItems = items;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Store className="h-6 w-6" />
          Marketplace
        </h1>
        <p className="text-muted-foreground mt-1">
          Entdecke Skills und Werkzeuge für deinen Assistenten
        </p>
      </div>

      {/* Tabs + Search */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setActiveCategory(null);
        }}
      >
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="skills">
              <Zap className="h-3.5 w-3.5 mr-1" />
              Skills
            </TabsTrigger>
            <TabsTrigger value="werkzeuge">
              <Wrench className="h-3.5 w-3.5 mr-1" />
              Werkzeuge
            </TabsTrigger>
            <TabsTrigger value="featured">
              <Star className="h-3.5 w-3.5 mr-1" />
              Empfohlen
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={activeCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(null)}
              className="h-7 text-xs"
            >
              <Filter className="h-3 w-3 mr-1" />
              Alle
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setActiveCategory(activeCategory === cat ? null : cat)
                }
                className="h-7 text-xs"
              >
                {categoryLabel(cat)}
              </Button>
            ))}
          </div>
        )}

        {/* Content (same for all tabs since filtering is done via API) */}
        {["all", "skills", "werkzeuge", "featured"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Store className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">Keine Items gefunden</p>
                <p className="text-sm">
                  Versuche einen anderen Filter oder Suchbegriff.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <MarketplaceCard
                    key={item.id}
                    item={item}
                    isInstalled={installedSlugs.has(item.slug)}
                    isInstalling={installing === item.slug}
                    onInstall={() => handleInstall(item)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ── Card Component ──

function MarketplaceCard({
  item,
  isInstalled,
  isInstalling,
  onInstall,
}: {
  item: MarketplaceItem;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}) {
  return (
    <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <CardTitle className="text-base leading-tight">
                {item.name}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {categoryLabel(item.category)} · v{item.version} ·{" "}
                <Download className="inline h-3 w-3" /> {item.install_count}
              </CardDescription>
            </div>
          </div>
          {item.featured && (
            <Badge
              variant="secondary"
              className="text-xs shrink-0"
            >
              <Star className="h-3 w-3 mr-0.5 fill-current" />
              Empfohlen
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3 flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {item.description}
        </p>
        {item.type === "werkzeug" &&
          item.requirements &&
          Object.keys(item.requirements).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.keys(item.requirements).map((key) => (
                <Badge key={key} variant="outline" className="text-[10px] font-mono">
                  {key}
                </Badge>
              ))}
            </div>
          )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className="w-full"
          size="sm"
          variant={isInstalled ? "outline" : "default"}
          disabled={isInstalled || isInstalling}
          onClick={onInstall}
        >
          {isInstalling ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Installiere...
            </>
          ) : isInstalled ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              Installiert
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-1.5" />
              Installieren
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
