"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

export type ChatAssetAttachment = {
  assetId: string;
  type: "image" | "video" | "upload";
};

type AttachmentContextType = {
  attachments: ChatAssetAttachment[];
  addAttachment: (attachment: ChatAssetAttachment) => void;
  removeAttachment: (assetId: string) => void;
  clearAttachments: () => void;
};

const AttachmentContext = createContext<AttachmentContextType | null>(null);

export function AttachmentProvider({ children }: { children: ReactNode }) {
  const [attachments, setAttachments] = useState<ChatAssetAttachment[]>([]);

  const addAttachment = useCallback((attachment: ChatAssetAttachment) => {
    setAttachments((prev) => {
      // Don't add duplicates
      if (prev.some((a) => a.assetId === attachment.assetId)) {
        return prev;
      }
      return [...prev, attachment];
    });
  }, []);

  const removeAttachment = useCallback((assetId: string) => {
    setAttachments((prev) => prev.filter((a) => a.assetId !== assetId));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return (
    <AttachmentContext.Provider
      value={{ attachments, addAttachment, removeAttachment, clearAttachments }}
    >
      {children}
    </AttachmentContext.Provider>
  );
}

export function useAttachments() {
  const context = useContext(AttachmentContext);
  if (!context) {
    throw new Error("useAttachments must be used within AttachmentProvider");
  }
  return context;
}

// Safe hook that returns null if not in provider (for optional usage)
export function useAttachmentsOptional() {
  return useContext(AttachmentContext);
}
