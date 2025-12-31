# Block User Edge Function

This Edge Function records a block and **fully deletes any chat** between the two users by deleting:
- `messages` for the shared `match_id`s
- the corresponding `matches` rows

This guarantees the chat disappears for **both** users (independent of client-side RLS).

## Deploy

```bash
# from repo root
supabase functions deploy block-user --project-ref <YOUR_PROJECT_REF>
```

Set the following environment variables (Supabase Dashboard → Project Settings → Functions → `block-user`):

| Key | Value |
| --- | --- |
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |

## Request

Authenticated request (client uses `supabase.functions.invoke`):

```json
{
  "blockedId": "<user_id_to_block>"
}
```


