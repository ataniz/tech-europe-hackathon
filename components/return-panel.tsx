"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AssetPreview } from "./asset-preview";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/db/schema";

type ReturnPanelProps = {
  chatId: string;
  isFinalized: boolean;
  onReturn: (assets: string[], summary?: string) => void;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ReturnPanel({
  chatId,
  isFinalized,
  onReturn,
}: ReturnPanelProps) {
  const { data: assets } = useSWR<Asset[]>(
    `/api/assets?chatId=${chatId}`,
    fetcher
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  const toggle = (id: string) => {
    if (isFinalized) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="border-t p-4 space-y-4">
      <h3 className="font-medium">Return to Parent</h3>
      {assets && assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => toggle(asset.id)}
              disabled={isFinalized}
              className={cn(
                "relative cursor-pointer rounded-md ring-2 ring-offset-2 transition-all",
                selected.includes(asset.id)
                  ? "ring-primary"
                  : "ring-transparent hover:ring-muted-foreground/50"
              )}
            >
              {selected.includes(asset.id) && (
                <div className="absolute top-1 left-1 z-10 rounded-full bg-primary p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <AssetPreview assetId={asset.id} size="sm" />
            </button>
          ))}
        </div>
      )}
      <Textarea
        placeholder="Optional summary..."
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        disabled={isFinalized}
      />
      <Button
        onClick={() => onReturn(selected, summary || undefined)}
        disabled={isFinalized || selected.length === 0}
      >
        {isFinalized ? "Already Returned" : "Return to Parent"}
      </Button>
    </div>
  );
}
