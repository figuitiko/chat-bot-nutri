# whatsapp-predefined-bot-backend

WhatsApp course automation platform built with Next.js App Router, Prisma, PostgreSQL, Twilio WhatsApp, Zod, Tailwind, and `shadcn/ui`. The app now includes both the production webhook runtime and an admin dashboard to manage courses, modules, conversation steps, assessments, learner access credentials, and enrollments.

## What ships

- Twilio WhatsApp inbound and status webhooks
- Course-based conversation runtime with:
  - one active course for new learners
  - pinned course continuity for learners already in progress
  - interactive quick replies and list pickers
  - media-first steps when configured
  - generic assessment scoring based on step metadata
- Admin dashboard for:
  - courses, modules, steps, transitions, and assets
  - contact access secrets
  - contact-to-course enrollments
- Protected internal APIs for operational messages and contact sync

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 7 + PostgreSQL
- Twilio Node SDK
- Zod
- Tailwind CSS 4
- `shadcn/ui`
- Vercel Blob for dashboard uploads

## Main routes

### Public runtime routes

- `POST /api/webhooks/twilio/whatsapp`
- `POST /api/webhooks/twilio/status`
- `GET /api/health`

### Internal protected routes

- `POST /api/messages/send`
- `POST /api/contacts/upsert`
- `POST /api/flows/execute`

### Admin UI

- `/login`
- `/dashboard`
- `/dashboard/courses`
- `/dashboard/courses/[courseId]`
- `/dashboard/contacts`
- `/dashboard/contacts/[contactId]`

## Environment variables

Copy `.env.example` to `.env.local` for local work.

Required for local development:

- `DATABASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_STATUS_CALLBACK_URL`
- `TWILIO_WEBHOOK_BASE_URL`
- `INTERNAL_API_KEY`
- `NODE_ENV`

Required for dashboard authentication:

- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Required for dashboard asset uploads:

- `BLOB_READ_WRITE_TOKEN`

Optional:

- `TWILIO_VALIDATE_SIGNATURE`
- `TWILIO_MEDIA_FOLLOWUP_DELAY_MS`

Production recommendation:

```env
NODE_ENV=production
TWILIO_VALIDATE_SIGNATURE=true
TWILIO_WEBHOOK_BASE_URL=https://your-domain.example
TWILIO_STATUS_CALLBACK_URL=https://your-domain.example/api/webhooks/twilio/status
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
INTERNAL_API_KEY=replace-with-a-long-random-api-key
SESSION_SECRET=replace-with-a-long-random-session-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
```

## Install and run

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Useful scripts:

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run verify`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:seed`
- `npm run db:studio`

## Seeded local data

The seed bootstraps:

- the `nutri` course as the initial managed course
- the admin user from env vars
- a sample learner contact enrolled in `nutri`

Sample learner for WhatsApp tests:

- phone: `+5215512345678`
- access secret: `NUTRI2026`

If a learner has several active course enrollments, the bot shows a course selector after the secret is validated.

## Dashboard workflow

### Courses

1. Open `/dashboard/courses`
2. Create a draft course
3. Open the course editor
4. Add modules, steps, transitions, and assets
5. Validate the flow
6. Activate the course when ready

Only one course can be active for new conversations at a time. Learners already inside a course stay pinned to the course they started with.

### Contacts and course access

1. Open `/dashboard/contacts`
2. Create or update the learner contact using the WhatsApp phone number
3. Set or reset the secret access key
4. Assign one or more active or draft courses

The bot uses the WhatsApp phone number as the learner identity. The learner must send the correct secret before the bot reveals the courses assigned to that contact.

## Twilio setup

For local webhook testing:

```bash
npm run dev
ngrok http 3000
```

Then set:

- `TWILIO_WEBHOOK_BASE_URL=https://<public-host>`
- `TWILIO_STATUS_CALLBACK_URL=https://<public-host>/api/webhooks/twilio/status`

Configure your Twilio WhatsApp sender:

1. Set the inbound webhook to `https://<public-host>/api/webhooks/twilio/whatsapp`
2. Set the status callback to `https://<public-host>/api/webhooks/twilio/status`
3. Use `POST` for both
4. Set `TWILIO_VALIDATE_SIGNATURE=true` once the URL is stable

## Internal API examples

All internal endpoints require `x-api-key`.

Create or update a contact:

```bash
curl -X POST http://localhost:3000/api/contacts/upsert \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-long-random-api-key" \
  -d '{
    "phone": "+5215512345678",
    "name": "Learner Demo",
    "profileName": "Learner Demo"
  }'
```

Send a predefined operational message:

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-long-random-api-key" \
  -d '{
    "contactPhone": "+5215512345678",
    "templateKey": "appointment_reminder",
    "variables": {
      "fecha": "15 de abril",
      "hora": "10:30"
    }
  }'
```

Execute a legacy operational flow:

```bash
curl -X POST http://localhost:3000/api/flows/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-long-random-api-key" \
  -d '{
    "contactPhone": "+5215512345678",
    "flowKey": "payment_reminder",
    "variables": {
      "monto": "$499",
      "fecha": "30 de abril"
    }
  }'
```

## Health endpoint

`GET /api/health` returns:

- service name and version
- database connectivity
- Twilio configuration presence
- Blob/dashboard configuration diagnostics

Use it for uptime probes and deploy smoke checks.

## Launch readiness

This repo now includes:

- route-level loading and error states for dashboard navigation
- empty states for dashboard surfaces
- mobile-safe dashboard navigation and form layouts
- accessibility improvements for labels, descriptions, and invalid interactive nesting cleanup
- tighter request validation for phone numbers, variables, and Twilio payloads
- documented verification and deploy steps

## Testing plan

There is not yet a full automated test suite. For release verification, use `docs/testing-plan.md`.

At minimum before deploy:

```bash
npm run verify
```

Then run a manual smoke pass:

1. Login to `/login`
2. Open `/dashboard`, `/dashboard/courses`, and `/dashboard/contacts`
3. Create or edit a draft course
4. Assign a learner contact and secret
5. Verify the learner can unlock the bot and select the expected course
6. Run one full lesson path, including one assessment
7. Confirm Twilio status callbacks update delivery states

## Vercel deployment notes

- Deploy as a Node-compatible Next.js app
- Run `npm run db:migrate` against production before first use
- Run `npm run db:seed` only if you want the production bootstrap data
- Configure all env vars in the Vercel project settings
- Add `BLOB_READ_WRITE_TOKEN` for dashboard uploads
- Keep `TWILIO_VALIDATE_SIGNATURE=true` in production
- Point Twilio webhooks to the production domain, not a preview deployment
- Ensure the public assets you attach through Twilio are reachable over HTTPS

This repo includes `vercel.json`, which uses `npm ci --loglevel=error` to keep upstream npm deprecation warnings from cluttering build logs.

## Known limitations

- There is no automated end-to-end test suite yet
- Course duplication and drag-and-drop ordering are not implemented
- Dashboard asset management supports upload and attachment, but not asset library browsing yet

## Verification commands

```bash
npm run lint
npm run typecheck
npm run build
```
