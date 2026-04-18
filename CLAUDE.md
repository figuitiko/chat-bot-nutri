# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (also runs prisma generate)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (also runs prisma generate + next typegen)
npm run test         # vitest in watch mode
npm run test:run     # vitest single run (used by verify)
npm run test:coverage  # vitest with v8 coverage report
npm run verify       # lint + typecheck + test:run + build (run before every deploy)
npm run db:migrate   # apply migrations to dev DB
npm run db:push      # push schema without migration (prototyping only)
npm run db:seed      # seed the nutri course + admin user + sample learner
npm run db:studio    # open Prisma Studio
```

Tests live in `__tests__/` folders alongside the code they cover. Pure functions with no DB dependency go directly in vitest — no mocks needed. Functions that hit `lib/db.ts` or `lib/twilio.ts` require mocking those modules with `vi.mock`.

## Architecture

### Request paths

**Inbound WhatsApp message** (the core path):
```
POST /api/webhooks/twilio/whatsapp
  → lib/services/webhooks-service.ts :: processInboundWebhook
    → routing chain (priority order, first match wins):
        1. handleGlobalCommand   (menu / restart / cancel)
        2. handleAccessRouting   (secret submission / course selection)
        3. handleCourseEngine    (active course conversation)
        4. handleLegacyEngine    (active legacy flow conversation)
        5. handleRuleRouting     (BotRule pattern match → template or flow)
        6. startAccessPrompt     (fallback: new contact or no reply)
```

**Status callback** (deferred follow-up trigger):
```
POST /api/webhooks/twilio/status
  → processStatusCallback → dispatches DeferredFollowUp on SENT/DELIVERED
```

**Internal APIs** (all require `x-api-key` header):
- `POST /api/messages/send` — send a template to a phone number
- `POST /api/contacts/upsert` — create/update contact
- `POST /api/flows/execute` — start a legacy flow for a contact

**Admin dashboard**: Next.js App Router RSC pages under `app/dashboard/` with Server Actions in `app/dashboard/actions.ts`. Protected by JWT session via `lib/admin-auth.ts`.

### Two conversation engines

The `Conversation` model has dual-use fields — one set per engine:

| Engine | Active fields |
|--------|--------------|
| **Course engine** (primary) | `courseId`, `currentCourseModuleId`, `currentCourseStepId` |
| **Legacy flow engine** | `flowId`, `currentStepId` |

The `Conversation.contextData` JSON blob carries captured values (user answers, variables) through a session.

### Service layer (`lib/services/`)

| File | Responsibility |
|------|---------------|
| `webhooks-service.ts` | Inbound routing orchestrator + status callback handler |
| `flows-service.ts` | Legacy flow execution, step progression, template sending |
| `course-runtime-service.ts` | Course step progression, deferred follow-ups |
| `access-service.ts` | Secret validation, course selection, enrollment checks |
| `contacts-service.ts` | Contact upsert by phone |
| `messages-service.ts` | Store inbound/outbound messages, map Twilio statuses |

### Bot engine (`lib/bot/`)

- `matcher.ts` — queries `BotRule` table, matches inbound text to a rule
- `state-machine.ts` — `matchStepTransition`, `mergeConversationContext`, `resolveCapturedValue`, `normalizeText`
- `responses.ts` — `renderTemplateBody` (variable interpolation), `ensureTemplateBody`
- `executor.ts` — `resolveInboundResponse` (thin wrapper over matcher), `executeTemplateOrFlow`

### Key patterns

**DeferredFollowUp**: when `deliveryMode = MEDIA_FIRST`, the media message is sent first and the follow-up payload is stored in `message.rawPayload.deferredFollowUp`. `processStatusCallback` dispatches it once Twilio confirms SENT or DELIVERED.

**Interactive templates**: `flows-service.ts` auto-creates Twilio Content API templates (quick-reply or list-picker) from `BotFlowStep.transitions` and caches the `twilioContentSid` on `MessageTemplate`.

**Cross-flow transitions**: `progressConversation` detects when `nextStep.flowId !== conversation.flowId` and upserts a new Conversation for the target flow.

**Webhook idempotency**: every inbound message checks `providerMessageSid` uniqueness before processing; status callbacks check `source + eventId` composite unique.

### Auth

- **Admin session**: `lib/admin-auth.ts` — JWT signed with `SESSION_SECRET`, stored as an httpOnly cookie. `requireAdminSession()` is called at the top of every Server Action.
- **Internal API key**: `lib/auth.ts` — SHA-256 hashed keys stored in `ApiKey` table; `env.INTERNAL_API_KEY` serves as a bootstrap key that bypasses the DB.

### Environment

All vars validated at startup via Zod in `lib/env.ts`. The app throws immediately if required vars are missing — check `lib/env.ts` for the full schema including optional vars and defaults.

### Prisma

Generated client is output to `generated/prisma/` (not `node_modules`). Always import from `@/generated/prisma/client`. Run `npm run db:generate` after any schema change before editing TypeScript.

### Path alias

`@/*` maps to the repo root. Use `@/lib/...`, `@/app/...`, `@/generated/...` throughout.
