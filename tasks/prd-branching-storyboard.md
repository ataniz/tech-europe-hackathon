# PRD: Branching Storyboard

## 1. Introduction/Overview

**Branching Storyboard** is a chat system feature that enables an orchestrator AI to spawn parallel sub-agent chats for collaborative storyboard creation. Each sub-agent works on a specific scene, generates media assets (images/videos), and returns results to the parent chat. The orchestrator resumes when all branches complete.

### Problem Statement
Creating multi-scene storyboards in a linear chat is tedious. Users need a way to:
- Break complex creative tasks into parallel workstreams
- Work on individual scenes with focused context
- Aggregate results back into a cohesive output

### Solution
A branching chat architecture where:
- Main "orchestrator" chat plans and delegates
- Sub-agent chats handle individual scenes
- Assets are referenceable across chats via UUIDs
- Results merge back when all branches return

---

## 2. Goals

1. Enable spawning of multiple sub-agent chats from an orchestrator chat
2. Support image and video generation within any chat
3. Allow assets to be attached to messages and referenced by UUID
4. Implement a return mechanism for sub-agents to send results to parent
5. Block orchestrator input until all sub-agents return
6. Provide clear navigation between parent and child chats

---

## 3. User Stories

### US-1: Storyboard Planning
> As a user, I want to describe a story concept and have the AI break it into scenes, so that I can work on each scene independently.

### US-2: Scene Generation
> As a user working in a sub-agent chat, I want to generate images for my scene, so that I can visualize the storyboard panel.

### US-3: Asset Attachment
> As a user, I want to attach generated assets to my messages, so that I can reference specific images when giving instructions.

### US-4: Branch Return
> As a user, I want to return my completed scene assets to the parent chat, so that all scenes can be combined.

### US-5: Orchestrator Resume
> As a user, I want the orchestrator chat to resume once all scenes are complete, so that I can see the full storyboard.

### US-6: Branch Navigation
> As a user, I want to click on a spawned branch to view its chat, so that I can work on or review individual scenes.

---

## 4. Functional Requirements

### 4.1 Data Model

#### FR-1: Asset Entity
The system must store assets with the following structure:
```typescript
type Asset = {
  id: string;           // UUID, primary key
  chatId: string;       // Foreign key to Chat
  type: 'image' | 'video' | 'upload';
  url: string;          // Local storage path
  prompt?: string;      // Generation prompt (for AI-generated)
  filename?: string;    // Original filename (for uploads)
  createdAt: Date;
};
```

#### FR-2: Extended Chat Entity
The Chat table must be extended with:
```typescript
type ChatExtensions = {
  parentChatId?: string;  // Foreign key to parent Chat (null for root)
  type: 'default' | 'orchestrator' | 'sub-agent';
  status: 'active' | 'returned' | 'finalized';
  returnValue?: {         // JSON, set when returned
    assets: string[];     // Asset UUIDs
    summary?: string;     // Optional text
  };
};
```

#### FR-3: User Message Format
User messages must support JSON content with attachments:
```typescript
type UserMessageContent = {
  text: string;
  attachments?: string[];  // Asset UUIDs
};
// Stored as JSON string in existing 'parts' field
```

### 4.2 Tools

#### FR-4: spawnSubAgents Tool
The system must provide a tool for spawning sub-agent chats:
- **Input**: Array of `{ name: string, brief: string, referenceAssets?: string[] }`
- **Behavior**:
  - Creates N new Chat records with `parentChatId` set to current chat
  - Sets parent chat `type` to 'orchestrator'
  - Copies full message history to each sub-agent
  - Each sub-agent uses default system prompt (not passed via tool)
- **Output**: `{ spawnedChats: Array<{ id: string, name: string }> }`

#### FR-5: generateImage Tool
The system must provide an image generation tool:
- **Input**: `{ prompt: string }`
- **Behavior**:
  - Calls Gemini AI Studio API (implementation separate)
  - Creates Asset record
  - Stores image in local storage
- **Output**: `{ assetId: string, url: string }`

#### FR-6: generateVideo Tool
The system must provide a video generation tool:
- **Input**: `{ prompt: string, referenceAssets?: string[] }`
- **Behavior**: Same as generateImage
- **Output**: `{ assetId: string, url: string }`

#### FR-7: returnToParent Tool
The system must provide a return mechanism for sub-agents:
- **Input**: `{ assets: string[], summary?: string }`
- **Behavior**:
  - Sets chat `status` to 'returned'
  - Stores `returnValue` JSON
  - Navigates user to parent chat
- **Output**: `{ success: boolean }`

### 4.3 Blocking & Resume Logic

#### FR-8: Orchestrator Blocking
When a chat has children with `status !== 'returned'`:
- Input field must be disabled
- UI must show waiting state with branch count (e.g., "Waiting for 2/3 branches")

#### FR-9: Orchestrator Resume
When all child chats have `status === 'returned'`:
- Input field becomes enabled
- Return values available as tool call results
- User initiates next message (no auto-generation)

#### FR-10: Return Mutability
- Returned chats remain editable until parent continues
- User can navigate back, continue chatting, and re-return
- Once parent sends a message after all returns, children become `finalized`

### 4.4 UI Components

#### FR-11: AssetPreview Component
- Renders image or video by UUID
- Fetches asset data from database
- Displays as card in chat

#### FR-12: AssetAttachment Component
- Shows attached assets below user message
- Visual indicator (arrow) connecting to message
- Displays asset thumbnails

#### FR-13: AttachmentBar Component
- Appears above input field
- Shows assets selected for attachment
- Allows removal before sending

#### FR-14: SpawnedAgentsCard Component
- Appears in tool call block for `spawnSubAgents`
- Lists all spawned branches with names
- Shows status per branch (active/returned)
- Shows aggregate progress (e.g., "2/3 returned")
- Each branch is clickable → navigates to sub-chat

#### FR-15: ReturnPanel Component
- Appears in sub-agent chats
- Allows selecting assets to return
- Optional summary text field
- "Return to Parent" button
- Can also be triggered by AI calling `returnToParent`

#### FR-16: BranchHeader Component
- Shows in sub-agent chat header
- Displays "Branch of [Parent Chat Title]"
- Back button to navigate to parent

#### FR-17: BlockedOverlay Component
- Overlays orchestrator input when blocked
- Shows "Waiting for N branches to return..."
- Lists branch names with status indicators

### 4.5 Navigation

#### FR-18: Branch Navigation
- Clicking branch in SpawnedAgentsCard opens sub-agent chat
- Sub-agent chat shows BranchHeader with parent link
- Returning auto-navigates to parent chat

#### FR-19: Chat URL Structure
- Sub-agent chats accessible at `/chat/[id]` (same as regular chats)
- UI adapts based on chat `type` and `parentChatId`

---

## 5. Non-Goals (Out of Scope)

1. **Multi-level nesting**: Only one level of branching (parent → children, no grandchildren)
2. **Real-time collaboration**: Single-user only
3. **Asset editing**: Generation is one-shot, no regeneration UI
4. **Asset gallery view**: Defer to future iteration
5. **Abandoned branch handling**: If user abandons a branch, parent stays blocked
6. **Asset tagging/search**: Simple UUID references only
7. **Video from images**: No automatic slideshow generation

---

## 6. Design Considerations

### Message Layout with Attachments
```
┌─────────────────────────────────────┐
│ User message text here...           │
└─────────────────────────────────────┘
  ↳ ┌───────┐ ┌───────┐
    │ img1  │ │ img2  │
    └───────┘ └───────┘
```

### SpawnedAgentsCard Layout
```
┌─────────────────────────────────────┐
│ ⚡ Spawned 3 sub-agents             │
├─────────────────────────────────────┤
│ ○ Scene 1: Opening shot    [active] │
│ ● Scene 2: Hero moment   [returned] │
│ ○ Scene 3: Finale          [active] │
├─────────────────────────────────────┤
│ Progress: 1/3 returned              │
└─────────────────────────────────────┘
```

### Sub-Agent Header
```
┌─────────────────────────────────────┐
│ ← Back │ Branch: Scene 2 of "Robot" │
└─────────────────────────────────────┘
```

---

## 7. Technical Considerations

### Files to Create

```
lib/
├── db/
│   ├── schema.ts              # MODIFY: Add Asset table, extend Chat
│   └── queries.ts             # MODIFY: Add asset & branch queries
│
├── ai/
│   ├── prompts.ts             # MODIFY: Add SUB_AGENT_SYSTEM_PROMPT
│   └── tools/
│       ├── spawn-sub-agents.ts    # CREATE
│       ├── generate-image.ts      # CREATE (placeholder for Gemini)
│       ├── generate-video.ts      # CREATE (placeholder for Gemini)
│       └── return-to-parent.ts    # CREATE

components/
├── asset-preview.tsx              # CREATE
├── asset-attachment.tsx           # CREATE
├── attachment-bar.tsx             # CREATE
├── spawned-agents-card.tsx        # CREATE
├── return-panel.tsx               # CREATE
├── branch-header.tsx              # CREATE
├── blocked-overlay.tsx            # CREATE
└── elements/
    └── message.tsx                # MODIFY: Support JSON user messages

app/
└── (chat)/
    ├── api/
    │   └── assets/
    │       └── route.ts           # CREATE: Asset CRUD endpoints
    └── chat/
        └── [id]/
            └── page.tsx           # MODIFY: Handle chat types
```

### Database Migration
```sql
-- New Asset table
CREATE TABLE "Asset" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" UUID NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
  "type" VARCHAR(10) NOT NULL,
  "url" TEXT NOT NULL,
  "prompt" TEXT,
  "filename" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "Asset_chatId_idx" ON "Asset"("chatId");

-- Extend Chat table
ALTER TABLE "Chat" ADD COLUMN "parentChatId" UUID REFERENCES "Chat"("id");
ALTER TABLE "Chat" ADD COLUMN "type" VARCHAR(20) DEFAULT 'default';
ALTER TABLE "Chat" ADD COLUMN "status" VARCHAR(20) DEFAULT 'active';
ALTER TABLE "Chat" ADD COLUMN "returnValue" JSONB;

CREATE INDEX "Chat_parentChatId_idx" ON "Chat"("parentChatId");
```

### Key Queries Needed
```typescript
// queries.ts additions
getChildChats(parentId: string): Promise<Chat[]>
getAssetById(id: string): Promise<Asset | null>
getAssetsByChatId(chatId: string): Promise<Asset[]>
createAsset(asset: NewAsset): Promise<Asset>
updateChatStatus(chatId: string, status: ChatStatus): Promise<void>
setChatReturnValue(chatId: string, returnValue: ReturnValue): Promise<void>
finalizeChatChildren(parentId: string): Promise<void>
```

### Local Storage Structure
```
public/
└── uploads/
    └── assets/
        ├── {uuid}.png
        ├── {uuid}.jpg
        └── {uuid}.mp4
```

---

## 8. Success Metrics

1. **Demo Completeness**: Successfully spawn 3+ sub-agents, generate images, return, and resume orchestrator
2. **Navigation Flow**: User can move between parent and child chats without confusion
3. **Asset Integrity**: All generated assets are retrievable by UUID across chats
4. **Blocking Accuracy**: Orchestrator correctly blocks/unblocks based on child status

---

## 9. Open Questions

1. **Asset size limits**: Should we enforce max file size for local storage?
2. **Chat title for sub-agents**: Auto-generate from brief or use scene name?
3. **Return confirmation**: Should there be a confirmation dialog before returning?
4. **History display in sub-agent**: Show full inherited history or collapse it?

---

## 10. Implementation Phases

### Phase 1: Data Layer (30 min)
- [ ] Add Asset table to schema
- [ ] Extend Chat table with new columns
- [ ] Run migration
- [ ] Add queries for assets and child chats

### Phase 2: Tools (45 min)
- [ ] Implement `spawnSubAgents` tool
- [ ] Create `generateImage` placeholder
- [ ] Create `generateVideo` placeholder
- [ ] Implement `returnToParent` tool
- [ ] Add sub-agent system prompt

### Phase 3: Blocking Logic (30 min)
- [ ] Add blocking check to chat API
- [ ] Implement resume detection
- [ ] Handle return value injection
- [ ] Add finalization logic

### Phase 4: UI Components (90 min)
- [ ] AssetPreview component
- [ ] AssetAttachment component
- [ ] AttachmentBar component
- [ ] SpawnedAgentsCard component
- [ ] ReturnPanel component
- [ ] BranchHeader component
- [ ] BlockedOverlay component

### Phase 5: Integration (45 min)
- [ ] Wire up navigation
- [ ] Update message rendering for JSON format
- [ ] Connect tools to UI
- [ ] Test full flow

---

## Appendix A: Sub-Agent System Prompt

```typescript
export const SUB_AGENT_SYSTEM_PROMPT = `You are a creative sub-agent working on a specific scene for a storyboard.

Your task is provided in the brief below. You have access to:
- generateImage: Create images for your scene
- generateVideo: Create videos for your scene
- returnToParent: Send your completed work back to the main storyboard

Focus on your assigned scene. Generate the required visual assets based on the brief.
When you've completed the scene to satisfaction, use returnToParent with your asset IDs.

Be creative but stay focused on the specific scene requirements.`;
```

## Appendix B: Message JSON Schema

```typescript
// User message content schema
const userMessageSchema = z.object({
  text: z.string(),
  attachments: z.array(z.string().uuid()).optional(),
});

// Parsing in message component
function parseUserMessage(parts: unknown): UserMessageContent {
  if (typeof parts === 'string') {
    try {
      return userMessageSchema.parse(JSON.parse(parts));
    } catch {
      return { text: parts };
    }
  }
  // Handle legacy format
  return { text: String(parts) };
}
```

## Appendix C: Return Value Schema

```typescript
const returnValueSchema = z.object({
  assets: z.array(z.string().uuid()),
  summary: z.string().optional(),
});

type ReturnValue = z.infer<typeof returnValueSchema>;
```
