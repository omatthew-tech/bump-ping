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

The function looks back 36 hours, requires ≥10 minutes of overlap, and increments `repeat_count` when the same pair overlaps again. Bumps become visible to the woman exactly 24 hours after `bumped_at`.

