# PRD: Storyboard Branching Chat System

## 1. Overview

A chat system enabling parallel creative workflows through branching conversations. An orchestrator AI spawns sub-agent chats to work on tasks (e.g., storyboard scenes) in parallel. Sub-agents generate media assets and return results to the parent. The orchestrator resumes when all branches complete.

**Timeline**: 4 hours (hackathon)
**Stack**: Next.js 15, AI SDK, Drizzle ORM, PostgreSQL, Gemini AI Studio

---

## 2. Core Concepts

### 2.1 Asset
A referenceable media object stored locally.

```typescript
type AssetType = 'image' | 'video' | 'upload';

type Asset = {
  id: string;           // UUID
  chatId: string;       // Creator chat
  type: AssetType;
  url: string;          // Local storage path
  prompt?: string;      // For AI-generated assets
  filename?: string;    // For uploads
  createdAt: Date;
};
```

### 2.2 User Message Format
Messages stored as JSON strings for unified handling of text + attachments.

```typescript
type UserMessageContent = {
  text: string;
  attachments?: string[];  // Asset UUIDs
};

// Storage: JSON.stringify(content) in parts field
// Rendering: Parse JSON → fetch assets → display
```

### 2.3 Chat Hierarchy

```
                    ┌─────────────────┐
                    │  ORCHESTRATOR   │
                    │  (parent chat)  │
                    │  status: active │
                    └────────┬────────┘
                             │ spawns
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ SUB-AGENT 1 │   │ SUB-AGENT 2 │   │ SUB-AGENT 3 │
    │ Scene: Intro│   │ Scene: Mid  │   │ Scene: End  │
    │ status: X   │   │ status: X   │   │ status: X   │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### 2.4 Chat Status Lifecycle

```typescript
type ChatType = 'default' | 'orchestrator' | 'sub-agent';
type ChatStatus = 'active' | 'returned' | 'finalized';
```

```
SUB-AGENT LIFECYCLE:
[active] ──user returns──► [returned] ──parent continues──► [finalized]
    ▲                           │
    └───────re-return───────────┘
         (editable until parent continues)

ORCHESTRATOR LIFECYCLE:
[default] ──spawns children──► [orchestrator/blocked]
                                      │
              all children returned───┘
                                      ▼
                               [orchestrator/unblocked]
                                      │
                              sends message───► children become [finalized]
```

### 2.5 Return Value Structure

```typescript
type ReturnValue = {
  assets: string[];      // Asset UUIDs
  summary?: string;      // Optional text
};
```

---

## 3. Database Schema

### 3.1 New Table: Asset

```typescript
// lib/db/schema.ts

export const asset = pgTable("Asset", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  type: varchar("type", { enum: ["image", "video", "upload"] }).notNull(),
  url: text("url").notNull(),
  prompt: text("prompt"),
  filename: text("filename"),
  createdAt: timestamp("createdAt").notNull(),
});

export type Asset = InferSelectModel<typeof asset>;
```

### 3.2 Extended Table: Chat

```typescript
// lib/db/schema.ts - Extend existing chat table

export const chat = pgTable("Chat", {
  // ...existing fields
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId").notNull().references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] }).notNull().default("private"),

  // NEW FIELDS
  parentChatId: uuid("parentChatId").references(() => chat.id),
  type: varchar("chatType", { enum: ["default", "orchestrator", "sub-agent"] })
    .notNull()
    .default("default"),
  status: varchar("status", { enum: ["active", "returned", "finalized"] })
    .notNull()
    .default("active"),
  returnValue: jsonb("returnValue").$type<ReturnValue | null>(),
});
```

### 3.3 New Queries

```typescript
// lib/db/queries.ts - Add these functions

// Asset queries
export async function createAsset(params: {
  chatId: string;
  type: AssetType;
  url: string;
  prompt?: string;
  filename?: string;
}): Promise<Asset>;

export async function getAssetById(id: string): Promise<Asset | null>;

export async function getAssetsByChatId(chatId: string): Promise<Asset[]>;

export async function getAssetsByIds(ids: string[]): Promise<Asset[]>;

// Branching queries
export async function getChildChats(parentChatId: string): Promise<Chat[]>;

export async function getParentChat(chatId: string): Promise<Chat | null>;

export async function updateChatStatus(
  chatId: string,
  status: ChatStatus
): Promise<void>;

export async function updateChatType(
  chatId: string,
  type: ChatType
): Promise<void>;

export async function setChatReturnValue(
  chatId: string,
  returnValue: ReturnValue
): Promise<void>;

export async function finalizeChildChats(parentChatId: string): Promise<void>;

export async function isOrchestratorBlocked(chatId: string): Promise<boolean>;

export async function createSubAgentChat(params: {
  parentChatId: string;
  title: string;
  userId: string;
}): Promise<Chat>;
```

---

## 4. Tools Specification

### 4.1 spawnSubAgents

**File**: `lib/ai/tools/spawn-sub-agents.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";

export const spawnSubAgents = ({ session, dataStream, chatId }) => tool({
  description: "Spawn parallel sub-agent chats to work on separate tasks. Each sub-agent receives context and a specific brief.",
  inputSchema: z.object({
    agents: z.array(z.object({
      name: z.string().describe("Name/title for this sub-agent branch"),
      brief: z.string().describe("The specific task/brief for this sub-agent"),
      referenceAssets: z.array(z.string()).optional()
        .describe("Asset UUIDs to include as references for this sub-agent"),
    })).min(1).max(10),
  }),
  execute: async ({ agents }) => {
    // 1. Get current chat, update type to 'orchestrator'
    // 2. Get full message history as newline-separated text
    // 3. For each agent:
    //    a. Create new chat with parentChatId set, type: 'sub-agent'
    //    b. Build system prompt: SUB_AGENT_SYSTEM_PROMPT + parent history context
    //    c. Create first user message with brief text + referenceAssets as attachments
    //    d. Trigger AI response immediately (background)
    // 4. Write to dataStream for UI update
    // 5. Return spawned chat info

    return {
      spawnedChats: agents.map(a => ({ id: "uuid", name: a.name })),
      message: `Spawned ${agents.length} sub-agents. Waiting for all to return.`,
    };
  },
});
```

### 4.2 generateImage

**File**: `lib/ai/tools/generate-image.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";

export const generateImage = ({ session, dataStream }) => tool({
  description: "Generate an image using AI based on a text prompt.",
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the image to generate"),
  }),
  execute: async ({ prompt }) => {
    // PLACEHOLDER: User implements Gemini AI Studio integration
    // 1. Call Gemini API with prompt
    // 2. Save image to local storage
    // 3. Create Asset record in database
    // 4. Return asset info

    return {
      assetId: "generated-uuid",
      url: "/uploads/generated/image.png",
    };
  },
});
```

### 4.3 generateVideo

**File**: `lib/ai/tools/generate-video.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";

export const generateVideo = ({ session, dataStream }) => tool({
  description: "Generate a video using AI based on a text prompt and optional reference assets.",
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the video to generate"),
    referenceAssets: z.array(z.string()).optional()
      .describe("Optional asset UUIDs to use as visual references"),
  }),
  execute: async ({ prompt, referenceAssets }) => {
    // PLACEHOLDER: User implements Gemini AI Studio integration
    // Similar to generateImage

    return {
      assetId: "generated-uuid",
      url: "/uploads/generated/video.mp4",
    };
  },
});
```

### 4.4 returnToParent

**File**: `lib/ai/tools/return-to-parent.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";

export const returnToParent = ({ session, dataStream, chatId }) => tool({
  description: "Return results to the parent orchestrator chat. Call this when the sub-agent task is complete.",
  inputSchema: z.object({
    assets: z.array(z.string()).describe("Asset UUIDs to return to parent"),
    summary: z.string().optional().describe("Brief summary of what was accomplished"),
  }),
  execute: async ({ assets, summary }) => {
    // 1. Validate this is a sub-agent chat
    // 2. Set chat status to 'returned'
    // 3. Store returnValue JSON
    // 4. Check if all siblings returned
    // 5. Signal UI to navigate to parent

    return {
      success: true,
      message: "Returned to parent chat",
      navigateTo: "parent-chat-id",
    };
  },
});
```

---

## 5. System Prompts & Sub-Agent Initialization

### 5.1 Sub-Agent Creation Flow

```
spawnSubAgents called
        │
        ▼
┌─────────────────────────────────────────────────────┐
│ For each agent:                                     │
│                                                     │
│ 1. Create Chat record                               │
│    - parentChatId: current chat                     │
│    - type: 'sub-agent'                              │
│    - title: agent.name                              │
│                                                     │
│ 2. Build SYSTEM PROMPT:                             │
│    - SUB_AGENT_SYSTEM_PROMPT (base)                 │
│    - Parent history (all messages, newline-joined)  │
│                                                     │
│ 3. Create FIRST USER MESSAGE:                       │
│    - text: agent.brief                              │
│    - attachments: agent.referenceAssets             │
│                                                     │
│ 4. TRIGGER AI RESPONSE (background, don't wait)    │
└─────────────────────────────────────────────────────┘
        │
        ▼
Sub-agent chat starts with AI already responding
User clicks in → sees conversation in progress
```

**Key behaviors:**
- Sub-agent chats do NOT appear in sidebar (only accessible via SpawnedAgentsCard)
- Sub-agent shows only its own messages (no parent history in UI)
- Parent history is embedded in system prompt as context
- After finalization, sub-agent chats become read-only but still viewable

### 5.2 Sub-Agent Default Prompt

**File**: `lib/ai/prompts.ts` (add to existing)

```typescript
export const SUB_AGENT_SYSTEM_PROMPT = `You are a creative sub-agent working on a specific scene or task within a larger storyboard project.

Your role:
- Focus on the brief provided in the first message
- Generate images and videos as needed using the available tools
- Be creative but stay aligned with the overall project direction
- When your task is complete, use returnToParent to send your results back

You have access to:
- generateImage: Create images based on prompts
- generateVideo: Create videos based on prompts
- returnToParent: Complete your task and return results

## Parent Conversation Context
The following is the conversation history from the main orchestrator chat:

`;

// Usage: systemPrompt = SUB_AGENT_SYSTEM_PROMPT + parentHistoryText
```

---

## 6. UI Components

### 6.1 Component Specifications

| Component | File | Purpose |
|-----------|------|---------|
| `AssetPreview` | `components/asset-preview.tsx` | Render image/video thumbnail by UUID |
| `AssetPicker` | `components/asset-picker.tsx` | Modal to select assets for attachment |
| `AttachmentBar` | `components/attachment-bar.tsx` | Show attached assets below input |
| `SpawnedAgentsCard` | `components/spawned-agents-card.tsx` | Tool call UI showing branches + status |
| `ReturnPanel` | `components/return-panel.tsx` | UI for selecting assets and returning |
| `BranchHeader` | `components/branch-header.tsx` | Header showing parent relationship |
| `BlockedOverlay` | `components/blocked-overlay.tsx` | Overlay when orchestrator is waiting |

### 6.2 AssetPreview

```typescript
// components/asset-preview.tsx

type AssetPreviewProps = {
  assetId: string;
  size?: 'sm' | 'md' | 'lg';
  showActions?: boolean;
};

// Features:
// - Fetches asset by ID (use SWR for caching)
// - Renders image or video player based on type
// - Optional actions: view full, download, copy ID
// - Loading skeleton while fetching
```

### 6.3 SpawnedAgentsCard

```typescript
// components/spawned-agents-card.tsx

type SpawnedAgentsCardProps = {
  spawnedChats: Array<{
    id: string;
    name: string;
    status: ChatStatus;
  }>;
  onNavigate: (chatId: string) => void;
};

// Features:
// - Shows "2/3 returned" progress
// - Each branch is clickable → navigates to sub-chat
// - Status indicators (spinner, checkmark, lock)
// - Visual distinction for returned vs active vs finalized
```

### 6.4 ReturnPanel

```typescript
// components/return-panel.tsx

type ReturnPanelProps = {
  chatId: string;
  onReturn: (assets: string[], summary?: string) => void;
};

// Features:
// - Only shown in sub-agent chats
// - Asset selector (checkboxes for chat's assets)
// - Optional summary text input
// - "Return to Parent" button
// - Disabled if already finalized
```

### 6.5 AttachmentBar

```typescript
// components/attachment-bar.tsx

type AttachmentBarProps = {
  attachments: string[];  // Asset UUIDs
  onRemove: (assetId: string) => void;
  onAdd: () => void;  // Opens AssetPicker
};

// Features:
// - Horizontal scrollable list of AssetPreview (small)
// - X button to remove each
// - + button to add more
// - Integrates with prompt input
```

---

## 7. File Modifications

### 7.1 API Route Changes

**File**: `app/(chat)/api/chat/route.ts`

```typescript
// Add to POST handler:

// 1. Check if chat is blocked (orchestrator with unreturned children)
const chat = await getChatById({ id });
if (chat?.type === 'orchestrator') {
  const blocked = await isOrchestratorBlocked(id);
  if (blocked) {
    return new ChatSDKError("blocked:orchestrator").toResponse();
  }
  // If not blocked and was orchestrator, finalize all children
  await finalizeChildChats(id);
}

// 2. Parse user message content (JSON with attachments)
// 3. Include asset data in model context if attachments present
```

### 7.2 Chat Page Changes

**File**: `app/(chat)/chat/[id]/page.tsx`

```typescript
// Add:
// - BranchHeader if chat.parentChatId exists
// - ReturnPanel if chat.type === 'sub-agent'
// - BlockedOverlay if orchestrator is blocked
// - Fetch child chats for SpawnedAgentsCard rendering
```

### 7.3 Message Rendering Changes

**File**: `components/elements/message.tsx`

```typescript
// For user messages:
// 1. Parse JSON content: { text, attachments }
// 2. Render text normally
// 3. Render AssetPreview for each attachment
```

### 7.4 Prompt Input Changes

**File**: `components/elements/prompt-input.tsx`

```typescript
// Add:
// - AttachmentBar integration
// - State for selected attachments
// - Modify submit to include attachments in JSON
// - AssetPicker trigger button
```

### 7.5 Tool Registration

**File**: `app/(chat)/api/chat/route.ts`

```typescript
// Add new tools to streamText config:
tools: {
  getWeather,
  createDocument: createDocument({ session, dataStream }),
  updateDocument: updateDocument({ session, dataStream }),
  requestSuggestions: requestSuggestions({ session, dataStream }),
  // NEW
  spawnSubAgents: spawnSubAgents({ session, dataStream }),
  generateImage: generateImage({ session, dataStream }),
  generateVideo: generateVideo({ session, dataStream }),
  returnToParent: returnToParent({ session, dataStream, chatId: id }),
},
```

---

## 8. Implementation Scope

### 8.1 Phase 1: Data Layer (45 min)
| Task | File | Priority |
|------|------|----------|
| Add Asset table to schema | `lib/db/schema.ts` | P0 |
| Extend Chat table with branching fields | `lib/db/schema.ts` | P0 |
| Generate migration | `pnpm db:generate` | P0 |
| Apply migration | `pnpm db:migrate` | P0 |
| Add asset queries | `lib/db/queries.ts` | P0 |
| Add branching queries | `lib/db/queries.ts` | P0 |

### 8.2 Phase 2: Tools (60 min)
| Task | File | Priority |
|------|------|----------|
| Implement spawnSubAgents | `lib/ai/tools/spawn-sub-agents.ts` | P0 |
| Scaffold generateImage | `lib/ai/tools/generate-image.ts` | P0 |
| Scaffold generateVideo | `lib/ai/tools/generate-video.ts` | P1 |
| Implement returnToParent | `lib/ai/tools/return-to-parent.ts` | P0 |
| Add sub-agent system prompt | `lib/ai/prompts.ts` | P0 |
| Register tools in route | `app/(chat)/api/chat/route.ts` | P0 |

### 8.3 Phase 3: Blocking Logic (30 min)
| Task | File | Priority |
|------|------|----------|
| Add blocking check to POST | `app/(chat)/api/chat/route.ts` | P0 |
| Add finalization on continue | `app/(chat)/api/chat/route.ts` | P0 |
| Add error type for blocked | `lib/errors.ts` | P0 |

### 8.4 Phase 4: UI Components (90 min)
| Task | File | Priority |
|------|------|----------|
| AssetPreview component | `components/asset-preview.tsx` | P0 |
| SpawnedAgentsCard component | `components/spawned-agents-card.tsx` | P0 |
| ReturnPanel component | `components/return-panel.tsx` | P0 |
| BranchHeader component | `components/branch-header.tsx` | P0 |
| BlockedOverlay component | `components/blocked-overlay.tsx` | P0 |
| AttachmentBar component | `components/attachment-bar.tsx` | P1 |
| AssetPicker component | `components/asset-picker.tsx` | P1 |

### 8.5 Phase 5: Integration (45 min)
| Task | File | Priority |
|------|------|----------|
| Update message rendering | `components/elements/message.tsx` | P0 |
| Update prompt input | `components/elements/prompt-input.tsx` | P1 |
| Update chat page layout | `app/(chat)/chat/[id]/page.tsx` | P0 |
| Navigation between chats | `components/spawned-agents-card.tsx` | P0 |
| Auto-navigate on return | `components/return-panel.tsx` | P0 |

---

## 9. File Tree (New/Modified)

```
lib/
├── db/
│   ├── schema.ts              [MODIFY] Add Asset, extend Chat
│   ├── queries.ts             [MODIFY] Add asset & branching queries
│   └── migrations/
│       └── XXXX_branching.sql [NEW] Migration file
├── ai/
│   ├── prompts.ts             [MODIFY] Add SUB_AGENT_SYSTEM_PROMPT
│   └── tools/
│       ├── spawn-sub-agents.ts   [NEW]
│       ├── generate-image.ts     [NEW] Placeholder
│       ├── generate-video.ts     [NEW] Placeholder
│       └── return-to-parent.ts   [NEW]
└── errors.ts                  [MODIFY] Add blocked error type

components/
├── asset-preview.tsx          [NEW]
├── asset-picker.tsx           [NEW]
├── attachment-bar.tsx         [NEW]
├── spawned-agents-card.tsx    [NEW]
├── return-panel.tsx           [NEW]
├── branch-header.tsx          [NEW]
├── blocked-overlay.tsx        [NEW]
└── elements/
    ├── message.tsx            [MODIFY] Parse JSON, render assets
    └── prompt-input.tsx       [MODIFY] Attachment support

app/
└── (chat)/
    ├── api/
    │   ├── assets/
    │   │   └── route.ts       [NEW] Asset CRUD endpoints (GET, POST)
    │   └── chat/
    │       └── route.ts       [MODIFY] Add tools, blocking logic
    └── chat/
        └── [id]/
            └── page.tsx       [MODIFY] Add branch UI components

public/
└── uploads/
    └── assets/                [NEW] Local asset storage directory
```

---

## 10. API Contracts

### 10.1 Spawn Response (Tool → UI)

```typescript
// dataStream writes
{ type: "spawned-agents", data: {
  chatIds: string[],
  names: string[]
}}
```

### 10.2 Return Response (Tool → UI)

```typescript
// dataStream writes
{ type: "branch-returned", data: {
  chatId: string,
  navigateTo: string  // parent chat ID
}}
```

### 10.3 Asset Created (Tool → UI)

```typescript
// dataStream writes
{ type: "asset-created", data: {
  assetId: string,
  url: string,
  type: AssetType
}}
```

---

## 11. Out of Scope (v1)

- Multi-level nesting (grandchildren)
- Real-time collaboration
- Asset search/tagging UI
- Drag-and-drop asset reordering
- Video playback controls
- Asset editing/cropping
- Undo/redo for returns
- Export storyboard as PDF/video

---

## 12. Success Criteria

**Demo Flow**:
1. User: "Create a 3-scene storyboard about a cat astronaut"
2. AI plans scenes, spawns 3 sub-agents
3. UI shows 3 branches with "0/3 returned"
4. User clicks into Scene 1 branch → AI already responding/working
5. User interacts, AI generates images
6. User clicks Return with selected assets
7. Auto-navigates to parent, shows "1/3 returned"
8. Repeat for remaining scenes
9. All return → orchestrator input unblocks
10. User continues → AI provides final storyboard summary

**Technical Criteria**:
- [ ] Sub-agents spawn and auto-start AI response (background)
- [ ] Sub-agents do NOT appear in sidebar
- [ ] Parent history passed via system prompt (not displayed in UI)
- [ ] Assets display correctly in messages
- [ ] Blocking prevents orchestrator messages until all return
- [ ] Returns are editable until parent continues (then finalized)
- [ ] Finalized sub-agents are read-only but viewable
- [ ] Navigation works both directions
