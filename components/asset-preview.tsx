"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";

type AssetPreviewProps = {
  assetId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-16 w-16",
  md: "h-32 w-32",
  lg: "h-48 w-48",
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AssetPreview({
  assetId,
  size = "md",
  className,
}: AssetPreviewProps) {
  const { data: asset, isLoading } = useSWR(
    `/api/assets?id=${assetId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          sizes[size],
          "bg-muted animate-pulse rounded",
          className
        )}
      />
    );
  }

  if (!asset) return null;

  return asset.type === "video" ? (
    <video
      src={asset.url}
      className={cn(sizes[size], "rounded object-cover", className)}
      controls
    />
  ) : (
    <img
      src={asset.url}
      alt={asset.prompt || "Asset"}
      className={cn(sizes[size], "rounded object-cover", className)}
    />
  );
}
