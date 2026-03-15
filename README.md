# whatsapp-predefined-bot-backend

Backend-only Next.js App Router service for Twilio WhatsApp automation. It receives inbound WhatsApp webhooks, matches messages against predefined rules, sends predefined replies, exposes protected internal APIs for outbound triggers, and persists contacts, conversations, messages, callbacks, and bot configuration in PostgreSQL through Prisma.

## Routes

- `POST /api/webhooks/twilio/whatsapp`: receives inbound Twilio WhatsApp webhooks, stores inbound events, matches bot rules, and sends predefined replies.
- `POST /api/webhooks/twilio/status`: receives Twilio delivery status callbacks and updates outbound message status.
- `POST /api/messages/send`: protected internal API for sending a predefined template or flow-driven outbound message.
- `POST /api/contacts/upsert`: protected internal API for synchronizing contacts.
- `POST /api/flows/execute`: protected internal API for reminders, handoffs, and programmatic flow execution.
- `GET /api/health`: machine-readable health probe with database connectivity.

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- Twilio Node SDK

## Environment

Copy [.env.example](/Users/frank/Workspace/next-js/chat-bot/.env.example) to `.env` and configure:

- `DATABASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_STATUS_CALLBACK_URL`
- `TWILIO_WEBHOOK_BASE_URL`
- `TWILIO_VALIDATE_SIGNATURE`
- `INTERNAL_API_KEY`
- `NODE_ENV`

## Install

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## Prisma Commands

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:seed`
- `npm run db:studio`

The initial SQL migration lives at [prisma/migrations/202603130001_init/migration.sql](/Users/frank/Workspace/next-js/chat-bot/prisma/migrations/202603130001_init/migration.sql).

## Seeded Spanish Flows

- `welcome`
- `pricing`
- `hours`
- `location`
- `human_handoff`
- `appointment_reminder`
- `payment_reminder`

## Local Twilio Testing

Run the app and expose it publicly:

```bash
npm run dev
ngrok http 3000
```

Update your `.env` values with the public host:

- `TWILIO_WEBHOOK_BASE_URL=https://<your-public-host>`
- `TWILIO_STATUS_CALLBACK_URL=https://<your-public-host>/api/webhooks/twilio/status`

Configure Twilio WhatsApp:

1. Open the WhatsApp sender configuration in the Twilio Console.
2. Set the inbound webhook to `https://<your-public-host>/api/webhooks/twilio/whatsapp`.
3. Set the status callback to `https://<your-public-host>/api/webhooks/twilio/status`.
4. Enable `TWILIO_VALIDATE_SIGNATURE=true` after your public URL is stable.

## Internal API Examples

All internal endpoints require the `x-api-key` header.

Upsert a contact:

```bash
curl -X POST http://localhost:3000/api/contacts/upsert \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-long-random-api-key" \
  -d '{
    "phone": "+5215512345678",
    "name": "Cliente Demo",
    "profileName": "Cliente Demo"
  }'
```

Send a predefined message:

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-long-random-api-key" \
  -d '{
    "contactPhone": "+5215512345678",
    "templateKey": "pricing"
  }'
```

Execute a flow:

```bash
curl -X POST http://localhost:3000/api/flows/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-long-random-api-key" \
  -d '{
    "contactPhone": "+5215512345678",
    "flowKey": "appointment_reminder",
    "variables": {
      "fecha": "15 de marzo",
      "hora": "10:30"
    }
  }'
```

## Webhook Handling

`POST /api/webhooks/twilio/whatsapp`

- accepts Twilio `application/x-www-form-urlencoded` payloads
- validates payloads with Zod
- optionally verifies the `X-Twilio-Signature`
- stores raw events in `WebhookEvent`
- upserts contacts, stores inbound messages, matches active bot rules, and sends predefined replies
- returns valid empty TwiML

`POST /api/webhooks/twilio/status`

- accepts Twilio `application/x-www-form-urlencoded` status callbacks
- validates payloads with Zod
- deduplicates callbacks by `MessageSid` and status combination
- updates outbound message status, error code, and error message

## Production Notes

- Route handlers use the Node.js runtime because Prisma and Twilio are server-side dependencies.
- There is no dashboard UI in the MVP.
- Keep all credentials server-side only.
- On Vercel, provision PostgreSQL separately and configure all environment variables in the project settings.
- The repository includes [vercel.json](/Users/frank/Workspace/next-js/chat-bot/vercel.json), which overrides the Vercel install step to `npm ci --loglevel=error` so upstream npm deprecation warnings from Twilio do not clutter deployment logs.
- Rotate `INTERNAL_API_KEY` regularly and consider managing additional keys via the `ApiKey` table.
- Structured JSON logging is enabled for webhook processing and Twilio send failures.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
