# Generate Bumps Edge Function

Run this Edge Function hourly (or at whatever cadence you prefer) to convert overlapping visits into `bumps` records.

## Deploy

```bash
# from repo root
supabase functions deploy generate-bumps \
  --project-ref kycmcmmpzxsjllyiqkhy \
  --no-verify-jwt
```

Set the following environment variables for the function (Supabase Dashboard → Project Settings → Functions → `generate-bumps`):

| Key | Value |
| --- | --- |
| `SUPABASE_URL` | `https://kycmcmmpzxsjllyiqkhy.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role key from project settings) |

## Cron

Use the Supabase Scheduled Triggers UI (Database → Functions → Triggers) or CLI to run it every hour:

```bash
supabase cron create bump-job \
  --project-ref kycmcmmpzxsjllyiqkhy \
  --schedule "0 * * * *" \
  --function generate-bumps
```

The function looks back 36 hours, requires ≥10 minutes of overlap, and increments `repeat_count` when the same pair overlaps again. Bumps are eligible for the woman to review immediately after creation (no 24-hour delay).

## Push notifications (new bump)

When the function inserts a brand new bump for a woman, it will send an Expo push notification:

- Title: `Someone just bumped you`
- Body: `See who it is`

### Requirements

1. Client must register tokens into a `push_tokens` table (this repo already upserts to `push_tokens` via `mobile/src/services/pushService.ts`).
2. The `push_tokens` table must contain at least:
   - `user_id` (uuid)
   - `token` (text)

No extra credentials are required for sending via Expo push API in this simple setup.

