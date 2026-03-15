# Project Guidelines

## Architecture

- This repository is a backend-only Next.js App Router service for Twilio WhatsApp automation. Prefer server-side implementations and avoid introducing dashboard UI code unless explicitly requested.
- Keep route handlers thin: authentication, request parsing, and response shaping belong in `app/api/**/route.ts`; business logic belongs in `lib/services/**` or `lib/bot/**`.
- Keep shared infrastructure concerns in `lib/**` utilities instead of duplicating logic inside route handlers or services.

## API Conventions

- Validate external request payloads with the existing Zod schemas in `lib/validation/**`.
- For protected internal endpoints, use `requireApiKey`.
- Use the shared HTTP helpers from `lib/http.ts` for success and error responses instead of ad hoc JSON shapes.
- Route handlers that depend on Prisma or Twilio should keep `export const runtime = "nodejs"`.

## Data And Messaging

- Use Prisma through the shared database client in `lib/db.ts`.
- Normalize phone numbers before persistence or outbound send operations.
- Persist outbound and inbound messaging state through the existing service layer instead of calling Prisma directly from routes.
- Keep Twilio credentials and other secrets server-side only.

## Build And Verification

- After meaningful code changes, prefer verifying with `npm run lint`, `npm run typecheck`, and `npm run build`.
- Keep changes consistent with the existing TypeScript style and path alias imports such as `@/lib/...`.
