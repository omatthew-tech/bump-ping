# Bump Ping — Landing Site

Simple Vite + React landing page that matches the mobile app vibe (Baloo 2 wordmark + animated ladybugs).

## 1) Install & run locally

```bash
cd web
npm install
cp env.example .env
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## 2) Configure Supabase (early access signup form)

The landing page submits emails into a Supabase table named `early_access_signups`.

### 2.1 Create the table (Supabase SQL Editor)

```sql
create table if not exists public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text null,
  created_at timestamptz not null default now(),
  -- prevent duplicates
  constraint early_access_signups_email_unique unique (email)
);

alter table public.early_access_signups enable row level security;

-- Allow anyone (anon) to insert emails for early access.
create policy "early_access_signups_insert_anon"
on public.early_access_signups
for insert
to anon
with check (true);

-- Optional: do NOT allow anon to read the list.
-- (No select policy means anon cannot select rows.)
```

### 2.2 Add env vars

Create `web/.env` (copy from `web/env.example`) and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

You can find these in Supabase Dashboard → **Project Settings → API**.

## 3) Pages

- `/` Landing + early access form
- `/privacy` Privacy Policy
- `/terms` Terms of Service

## 4) Build / preview

```bash
npm run build
npm run preview
```

## 5) Deploy options

This is a static site after build (`web/dist`), so it works well with:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages (with a small config tweak if you need SPA routing)


