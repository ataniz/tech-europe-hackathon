"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  useAttachmentsOptional,
  type ChatAssetAttachment,
} from "./attachment-context";
import { Button } from "./ui/button";

type AssetPreviewProps = {
  assetId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showAttachButton?: boolean;
};

const sizes = {
  sm: "max-h-16 max-w-24",
  md: "max-h-32 max-w-48",
  lg: "max-h-48 max-w-72",
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function FullScreenPreview({
  asset,
  onClose,
  onAttach,
  isAttached,
  showAttachButton,
}: {
  asset: { url: string; type: string; prompt?: string };
  onClose: () => void;
  onAttach?: () => void;
  isAttached?: boolean;
  showAttachButton?: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {asset.type === "video" ? (
          <video
            src={asset.url}
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
            controls
            autoPlay
          />
        ) : (
          <img
            src={asset.url}
            alt={asset.prompt || "Asset"}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}

        {showAttachButton && onAttach && (
          <Button
            size="sm"
            variant={isAttached ? "secondary" : "default"}
            className={cn(
              "absolute top-3 right-3 size-10 p-0 rounded-full shadow-lg shadow-black/50 transition-opacity",
              isAttached && "bg-green-500 hover:bg-green-600"
            )}
            onClick={onAttach}
            disabled={isAttached}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
}

export function AssetPreview({
  assetId,
  size = "md",
  className,
  showAttachButton = false,
}: AssetPreviewProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const attachmentContext = useAttachmentsOptional();
  const { data: asset, isLoading } = useSWR(
    `/api/assets?id=${assetId}`,
    fetcher
  );

  const handleAttach = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (attachmentContext && asset) {
        attachmentContext.addAttachment({
          assetId: asset.id,
          type: asset.type,
        } as ChatAssetAttachment);
      }
    },
    [attachmentContext, asset]
  );

  const isAttached = attachmentContext?.attachments.some(
    (a) => a.assetId === assetId
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          "h-24 w-24 bg-muted animate-pulse rounded",
          className
        )}
      />
    );
  }

  if (!asset) return null;

  return (
    <>
      <div
        className={cn("group cursor-pointer inline-block", className)}
        onClick={() => setIsFullScreen(true)}
      >
        <div className="relative inline-block">
          {asset.type === "video" ? (
            <video
              src={asset.url}
              className={cn(sizes[size], "rounded object-contain pointer-events-none")}
            />
          ) : (
            <img
              src={asset.url}
              alt={asset.prompt || "Asset"}
              className={cn(sizes[size], "rounded object-contain")}
            />
          )}

          {showAttachButton && attachmentContext && (
            <Button
              size="sm"
              variant={isAttached ? "secondary" : "default"}
              className={cn(
                "absolute top-1 right-1 size-6 p-0 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity",
                "shadow-black/30",
                isAttached && "opacity-100 bg-green-500 hover:bg-green-600"
              )}
              onClick={handleAttach}
              disabled={isAttached}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {isFullScreen && asset && (
        <FullScreenPreview
          asset={asset}
          onClose={() => setIsFullScreen(false)}
          showAttachButton={showAttachButton && !!attachmentContext}
          isAttached={isAttached}
          onAttach={() => {
            if (attachmentContext && asset) {
              attachmentContext.addAttachment({
                assetId: asset.id,
                type: asset.type,
              } as ChatAssetAttachment);
            }
          }}
        />
      )}
    </>
  );
}
