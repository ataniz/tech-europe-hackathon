# Tasks: Storyboard Branching Chat System

Generated from `PRD.md`

---

### Relevant Files

- `lib/db/schema.ts` – ✅ Added Asset table, extended Chat table with branching fields (parentChatId, chatType, status, returnValue)
- `lib/db/queries.ts` – ✅ Added 4 asset queries + 8 branching queries
- `lib/db/migrations/0008_brief_genesis.sql` – Migration for Phase 1 schema changes
- `lib/ai/prompts.ts` – ✅ Added SUB_AGENT_SYSTEM_PROMPT constant
- `lib/ai/tools/spawn-sub-agents.ts` – ✅ Tool to spawn parallel sub-agent chats
- `lib/ai/tools/generate-image.ts` – ✅ Placeholder tool for Gemini image generation
- `lib/ai/tools/generate-video.ts` – ✅ Placeholder tool for Gemini video generation
- `lib/ai/tools/return-to-parent.ts` – ✅ Tool to return results to parent chat
- `lib/types.ts` – ✅ Extended with new tool types and CustomUIDataTypes
- `app/(chat)/api/chat/route.ts` – ✅ Registered 4 new tools
- `lib/errors.ts` – ✅ Added blocked:orchestrator error type
- `app/(chat)/api/assets/route.ts` – ✅ Asset GET API endpoint (by id or chatId)
- `components/asset-preview.tsx` – ✅ Render image/video by asset UUID
- `components/spawned-agents-card.tsx` – ✅ Show spawned branches with status
- `components/return-panel.tsx` – ✅ UI for selecting assets and returning
- `components/branch-header.tsx` – ✅ Header showing parent relationship
- `components/blocked-overlay.tsx` – ✅ Overlay when orchestrator is waiting
- `components/message.tsx` – ✅ Added tool renderers for new tools
- `app/(chat)/chat/[id]/page.tsx` – ✅ Fetches branching metadata, passes to Chat component
- `components/chat.tsx` – ✅ Renders BranchHeader, ReturnPanel, BlockedOverlay based on chat type
- `components/data-stream-handler.tsx` – ✅ Handles auto-navigation on branch return
- `public/uploads/assets/` – ✅ Directory for local asset storage
- `components/attachment-context.tsx` – ✅ NEW - Context for managing asset attachments
- `components/asset-preview.tsx` – ✅ Updated with attach button
- `components/multimodal-input.tsx` – ✅ Updated to use attachment context and send JSON format
- `components/message.tsx` – ✅ Updated to parse JSON user messages, render uploads above and attachments below with L-arrow

---

## Tasks

- [x] 1.0 Data Layer: Schema & Queries
    - [x] 1.1 Add Asset table to `lib/db/schema.ts` with fields: id, chatId, type, url, prompt, filename, createdAt
    - [x] 1.2 Extend Chat table in `lib/db/schema.ts` with: parentChatId, chatType, status, returnValue
    - [x] 1.3 Run `pnpm db:generate` to create migration file
    - [x] 1.4 Run `pnpm db:migrate` to apply migration
    - [x] 1.5 Add asset queries to `lib/db/queries.ts`: createAsset, getAssetById, getAssetsByChatId, getAssetsByIds
    - [x] 1.6 Add branching queries to `lib/db/queries.ts`: getChildChats, getParentChat, updateChatStatus, updateChatType, setChatReturnValue, finalizeChildChats, isOrchestratorBlocked, createSubAgentChat

- [x] 2.0 AI Tools: Spawn, Generate, Return
    - [x] 2.1 Add SUB_AGENT_SYSTEM_PROMPT to `lib/ai/prompts.ts`
    - [x] 2.2 Create `lib/ai/tools/spawn-sub-agents.ts` with spawnSubAgents tool (creates chats, injects brief as first message, triggers AI response)
    - [x] 2.3 Create `lib/ai/tools/generate-image.ts` placeholder (returns mock assetId/url, creates Asset record)
    - [x] 2.4 Create `lib/ai/tools/generate-video.ts` placeholder (returns mock assetId/url, creates Asset record)
    - [x] 2.5 Create `lib/ai/tools/return-to-parent.ts` (sets status to returned, stores returnValue, signals navigation)
    - [x] 2.6 Register all 4 new tools in `app/(chat)/api/chat/route.ts` tools config

- [x] 3.0 Blocking & Resume Logic
    - [x] 3.1 Add "blocked:orchestrator" error type to `lib/errors.ts`
    - [x] 3.2 Add blocking check in `app/(chat)/api/chat/route.ts` POST handler (check isOrchestratorBlocked before processing)
    - [x] 3.3 Add finalization logic: when orchestrator continues after all returns, call finalizeChildChats
    - [x] 3.4 Filter sub-agent chats from sidebar query in history API

- [x] 4.0 UI Components
    - [x] 4.1 Create `components/asset-preview.tsx` – fetches asset by ID, renders image or video, supports sm/md/lg sizes
    - [x] 4.2 Create `components/spawned-agents-card.tsx` – displays branches with status indicators, progress count, clickable navigation
    - [x] 4.3 Create `components/return-panel.tsx` – asset selector with click-based selection, optional summary input, Return button, disabled when finalized
    - [x] 4.4 Create `components/branch-header.tsx` – shows "Branch of [Parent]" with back navigation button
    - [x] 4.5 Create `components/blocked-overlay.tsx` – overlay on input showing "Waiting for N branches..."
    - [x] 4.6 Wire tool renderers in `components/message.tsx` – spawnSubAgents, generateImage, generateVideo, returnToParent
    - [x] 4.7 Create `app/(chat)/api/assets/route.ts` – GET (by id or chatId) endpoint
    - [ ] 4.8 (Deferred) Create `components/attachment-bar.tsx` – horizontal list of attached assets with remove buttons
    - [ ] 4.9 (Deferred) Create `components/asset-picker.tsx` – modal to browse and select chat assets for attachment

- [x] 5.0 Integration & Wiring
    - [x] 5.1 Update `components/message.tsx` to parse JSON user messages and render AssetPreview for attachments
    - [x] 5.2 Update `components/multimodal-input.tsx` to support asset attachments via context
    - [x] 5.3 Update `app/(chat)/chat/[id]/page.tsx` to fetch branching metadata and pass to Chat
    - [x] 5.4 Update `components/chat.tsx` to show ReturnPanel for sub-agent chats
    - [x] 5.5 Update `components/chat.tsx` to show BlockedOverlay when orchestrator is blocked
    - [x] 5.6 Wire SpawnedAgentsCard into tool call rendering with navigation to sub-chats (Done in Phase 4)
    - [x] 5.7 Implement auto-navigation to parent on return (via router.push in data-stream-handler.tsx)
    - [x] 5.8 Create `public/uploads/assets/` directory for local asset storage
    - [ ] 5.9 Test full demo flow: spawn → work in branches → return → resume orchestrator
