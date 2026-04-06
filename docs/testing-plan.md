# Testing Plan

This project currently relies on verification commands plus a structured manual smoke pass. Use this plan before launch, after major schema changes, and before switching the active course in production.

## Automated verification

Run:

```bash
npm run verify
```

This covers:

- ESLint
- TypeScript + generated Next/Prisma types
- production build

## Manual smoke checklist

### Dashboard and auth

1. Open `/login`
2. Sign in with the configured admin credentials
3. Open `/dashboard`
4. Verify the summary cards load without console or server errors
5. Open `/dashboard/courses`
6. Open `/dashboard/contacts`

### Courses and content management

1. Create a draft course
2. Add at least one module
3. Add at least one content step
4. Add one question step and one result step
5. Add transitions between steps
6. Upload one image or audio asset through the dashboard
7. Activate the course and verify the previous active course becomes inactive

### Contact access and enrollment

1. Create or update a contact with a WhatsApp number
2. Set a secret key
3. Assign one course
4. Assign multiple courses to a different contact
5. Revoke one enrollment and confirm it disappears from the active list

### WhatsApp runtime

1. Send a first message from a learner number not yet verified
2. Confirm the bot asks for the secret
3. Send the correct secret
4. If the learner has one course, confirm it starts automatically
5. If the learner has multiple courses, confirm the bot shows a selector
6. Enter a course and continue at least one content step, one media step, and one assessment question

### Assessments

1. Complete the seeded 4-question evaluation
2. Verify correct and incorrect answers are handled as expected
3. Confirm the score summary shows correct answers, total questions, and percentage
4. Add a different assessment with a different number of questions or weights and verify the result still computes correctly

### Twilio integration

1. Verify `POST /api/webhooks/twilio/whatsapp` receives inbound messages
2. Verify `POST /api/webhooks/twilio/status` receives delivery updates
3. Confirm outbound media steps do not loop or duplicate unexpectedly
4. Confirm `GET /api/health` returns database and Twilio diagnostics

### Error and edge cases

1. Enter a wrong secret several times and verify failed attempts increase
2. Verify locked credentials stop access until reset or unlock
3. Test a contact with no active enrollments and confirm the bot responds clearly
4. Open a missing course/contact dashboard route and confirm the not-found UI appears
5. Temporarily break a dashboard query in development and confirm the route-level error UI appears

## Production readiness sign-off

Only mark a release ready when:

- `npm run verify` passes
- the manual smoke checklist passes on the deployed environment
- Twilio webhooks point to the correct production domain
- the active course and learner access data were reviewed in the dashboard
