# Bump Ping – MVP Product & Tech Plan

## 1. Product Overview
- **Positioning**: Location-based dating experience that transforms “near misses” at vetted public places into woman-led matches.
- **Target launch market**: Single campus or dense neighborhood where repeated encounters are likely.
- **Differentiators**: Women control visibility, context-rich icebreakers (“you crossed paths near Campus Gym”), zero swiping grind, and strict place curation for safety.
- **MVP success signals**: (1) ≥80 % of signups complete onboarding, (2) ≥30 % of active women receive ≥1 bump after 24 h, (3) ≥25 % of bumps where she taps “Yes” convert to chats, (4) <5 % weekly reports/blocks per active user.

## 2. Product Principles & Constraints
- **Woman-first privacy**: Only women learn where/when bumps happened; men only know “someone you crossed paths with likes you.”
- **Straight-only MVP**: Gender radio (woman/man) + implicit straight pairing; revisit inclusivity once loops proven.
- **Age gating**: Checkbox confirmation (18+) stored as `is_18_plus_confirmed`; no age shown.
- **Context over precision**: Store visits only for curated public categories; no homes/offices, no precise timelines surfaced in UI.
- **Playful tone**: Copy leans into crush fantasies (“Did you bump into the QB again?”) while staying respectful.

## 3. Personas & Core Jobs
| Persona | Goals | Pain points solved |
| --- | --- | --- |
| Woman student/young pro | Meet interesting men she already notices in safe way; stay in control | Creepy location tracking, DM spam, awkward cold starts |
| Man student/young pro | Discover if the woman he keeps seeing is interested | Fear of rejection, lack of context to start convo |
| Admin | Keep community safe, seed places, handle reports | Need lightweight tooling, audit trails |

## 4. Key Flows
1. **Auth & onboarding**: Phone → OTP → 5-step onboarding (18+ & gender, first name, photos 1–3, optional bio + interests chips, location explainer → OS permission).
2. **Visit logging**: Device registers geofences for curated places, posts enter/exit to backend, backend writes visits ≥10 min.
3. **Bump generation**: Hourly job pairs overlapping visits (woman/man, ≥10 min overlap), creates or updates bump (with `repeat_count`), schedules visibility 24 h later.
4. **Woman bump feed**: Shows eligible bumps once visible, hides any previously “No”-ed men, allows `Yes` → profile → “Send Ping.”
5. **Man likes feed**: Shows confirmed pings (`is_confirmed=true`), allows `Match` → creates chat or `No`.
6. **Chat & safety**: Basic messaging with block/report. Blocking removes chat + suppresses future bumps/matches with that user.
7. **Admin**: Minimal Supabase dashboard + SQL views (users, bumps, reports) + ability to toggle `status='banned'` on auth user.

## 5. UX & UI Surfaces (React Native / Expo)
| Surface | Highlights |
| --- | --- |
| Login & OTP | Minimal form, inline ToS/Privacy links. OTP countdown + resend. |
| Onboarding steps | Progress bar (5 dots). Interests as pill chips. Photo uploader with storage upload status (1/3, 2/3). |
| Location explainer | Friendly illustrations/icon, CTA “Okay, continue” → triggers OS background location prompt via Expo Location (Always/Precise). |
| Tabs (Bumps, Chats, Profile) | Bottom nav via `@react-navigation/bottom-tabs`. |
| Woman bump card | Photo carousel snap, context text, repeat badge, `No` + `Yes` → full profile sheet with “Send Ping.” |
| Man likes card | Single photo, anon copy, `No` + `Match`. |
| Chat | Standard message bubbles, typing box, inline tip (“You crossed paths yesterday—ask about their coffee order”), overflow menu for Block/Report/Delete. |
| Profile/settings | Edit photos/bio/interests, toggle “Pause bumping,” delete account, view referral code, legal links. |

## 6. Tech Stack
- **Client**: React Native (Expo) using React hooks, TypeScript, `expo-location` for background geofencing, `react-query` for cache/sync, `expo-notifications` for push.
- **Backend**: Supabase (Postgres, Auth via phone OTP, Storage for photos, Edge Functions for secure logic) + optional lightweight Cloud Scheduler (Supabase cron) for bump job.
- **APIs**: Mostly Supabase row-level security (RLS) policies + RPC/Edge Functions for visit logging, bump fetching, block/report actions.
- **Notifications**: Expo push tokens stored per device; Supabase function triggers send when bumps become visible or man receives ping.
- **Platform choice**: Commit to Expo-native shipping only. A PWA fallback (Progressive Web App running in browsers) is excluded for MVP because background geofencing/push reliability require native capabilities.

## 7. Data Model (Supabase)
Tables largely follow the provided schema; additions highlighted:
- `profiles`, `photos`, `places`, `visits`, `bumps`, `likes`, `matches`, `messages`, `reports`.
- **New supporting tables**:
  - `blocks (blocker_id, blocked_id, created_at)` to filter bumps/matches.
  - `referrals (user_id, referral_code unique, referrer_id nullable)` or simply add `referral_code`, `referrer_id` columns on `profiles`.
  - `user_status (user_id, is_paused boolean default false, is_banned boolean default false)`.
- **Place sourcing**: Seed and refresh `places` via a Google Places (or similar) integration filtered to the allowed categories, no manual review required.
- **Computed helpers**:
  - `duration_minutes` on `visits`.
  - `visible_to_woman_at = bumped_at + interval '24 hours'`.
  - Materialized view `woman_bump_feed` (optional) to pre-join photos + place text.

### 7.1 How the Google Places integration works
1. **Fetch candidates**: Use the Places Nearby Search API with our launch city’s lat/lng bounds, filtering by allowed `type` (`gym`, `cafe`, `restaurant`, `university`, `library`, `park`, `bar`). Store the upstream `place_id`.
2. **Normalize fields**: For each hit, pull details (`name`, `geometry`, `formatted_address`, `rating`, `opening_hours`, `website`, `photos`). Map to our `places` table (`name`, `lat`, `lng`, `category`, `city`, optional `external_source='google_places'`).
3. **Auto-approval heuristics**: Apply rules before insertion: minimum 3.5 average rating, ≥20 Google reviews, `business_status='OPERATIONAL'`, and exclude venues with keywords like “residence,” “office,” “clinic.” If the venue passes, insert directly into `places` with `is_active=true`; otherwise skip automatically.
4. **Deduping**: Use the Google `place_id` as a unique constraint (`external_place_id`). If Google updates the venue, we upsert by that key.
5. **Sync cadence**: Nightly cron queries Google Places for additions/closures. For closures, set `is_active=false` so existing visits remain but future geofences skip the venue.
6. **Quota management**: Cache responses in Supabase Storage or Redis (optional) and avoid re-fetching details more than once per 24 h per place. Batch requests off-peak to stay under the free-tier quota.
7. **Fallback entries**: If ambassadors request a venue not on Google (e.g., pop-up), admins can still create it manually in `places` with `external_source='manual'`.

## 8. API & Edge Function Sketch
| Endpoint / Function | Purpose | Notes |
| --- | --- | --- |
| `POST /auth/v1/otp` (Supabase) | Phone login | Provided by Supabase |
| `POST /profiles` | Finish onboarding | Validates 18+ checkbox, gender, first name |
| `POST /photos/upload` | Use Supabase Storage signed upload URLs | Enforce max 3 |
| `GET /places/nearby?lat&lng` | Return top 15 curated public places | Filter by category whitelist |
| `POST /visits/record` (Edge Func) | Persist visit if duration ≥10 min | Server-side validation + dedup |
| `GET /bumps/woman-feed` | Woman cards (visible + not dismissed) | Query excludes blocked + `likes.decision='no'` |
| `POST /bumps/:id/decision` | Woman `No`, `Yes`, `Send Ping` | `Yes` creates like, `Send Ping` toggles `is_confirmed` |
| `GET /likes/incoming` | Man cards awaiting response | Only confirmed likes, no existing match |
| `POST /likes/:id/respond` | Man `No` or `Match` | Match creation + chat bootstrap |
| `GET /matches`, `GET /matches/:id/messages`, `POST /messages` | Chat |
| `POST /blocks`, `POST /reports` | Safety actions |
| `POST /account/delete` | Soft delete profile, purge data async |

All non-public logic (visit inserts, bump job, match creation) lives in Edge Functions to keep RLS tight; client uses supabase-js with service role functions only via serverless endpoints.

## 9. Location & Bump Logic
**Client (React Native)**
1. Fetch top 15 nearby places via `/places/nearby`.
2. Register geofences (radius 75 m) using `Location.startGeofencingAsync`.
3. On ENTER/EXIT events:
   - Buffer events locally until both times known.
   - Discard visits <10 min before uploading.
   - POST to `/visits/record` with `enter_time`, `exit_time`, `place_id`. Include offline queue.

**Edge Function: `/visits/record`**
```text
1. Validate auth + gender data.
2. Ensure place_id is in allowed categories.
3. Clamp overlapping visits by same user (merge windows if needed).
4. Reject if duration <10 min or >8 h (suspicious).
5. Insert into `visits`.
```

**Bump Cron Job (hourly Supabase cron + Edge Function)**
```text
1. Select visits updated in last 36 h grouped by place.
2. Partition by gender: women vs men.
3. For each woman/man pair at same place, compute overlap (max(start_w, start_m) vs min(end_w, end_m)).
4. If overlap ≥10 min:
   - Check existing `bumps` (woman_id + man_id).
   - If exists: increment `repeat_count`, update `place_id`, `overlap_minutes`, and `bumped_at` (use latest midpoint).
   - Else: insert new bump with `visible_to_woman_at = bumped_at + interval '24 hours'`.
5. Trigger push notification to woman exactly when `visible_to_woman_at` <= now.
```

## 10. Matching & State Machine
State transitions (simplified):
1. **Bump created** → `status=waiting_woman` (hidden until visibility time).
2. **Visible** → Woman `No` → mark `likes.decision='no'`, set `status=resolved_no`.
3. Woman `Yes` → create like `decision='yes', is_confirmed=false`.
4. Woman taps “Send Ping” → `is_confirmed=true`, notify man → `status=awaiting_man`.
5. Man `No` → optional `man_rejected=true`, keep record for analytics; woman is never notified when a ping is declined.
6. Man `Match` → create `matches` row + initial chat thread → `status=matched`.

Ensure future bumps for same pair respect prior decisions:
- If woman ever chose `No`, new bumps for same man stay hidden unless product later enables overrides.
- If man rejected a confirmed ping, suppress re-showing until pair overlaps again and woman re-initiates (optional).

## 11. Safety, Moderation, Privacy
- Blocks table enforced at query layer (`WHERE NOT EXISTS block relationship`).
- Reports insert triggers admin alerts (email/slack). Provide basic reason taxonomy (“Harassment”, “Fake profile”, etc.).
- Admin dashboard (Supabase SQL Editor + simple React admin page) shows:
  - Recent reports (reporter, reported, reason, linked chat excerpt).
  - Ability to ban (set `is_banned=true`, revoke refresh tokens).
  - Place management CRUD.
- Moderation SLA (Service Level Agreement): acknowledge new reports within 24 hours and resolve/close them within 72 hours unless escalated.
- Privacy commitments:
  - Visits truncated to place & time window; never expose coordinates to other users.
  - Data retention policy: delete visit history 60 days after match/chats closed.
  - Provide in-app delete flow (soft delete + background purge).

## 12. Rollout Plan
1. **Preparation (Week 0–1)**: Seed 20–100 verified venues in Supabase, recruit 5–10 ambassadors, craft ToS/Privacy.
2. **Internal dogfood (Week 2)**: Closed beta with team & trusted friends; verify geofence accuracy and bump timing.
3. **Soft launch (Week 3)**: Invite-only within chosen campus; track KPIs nightly, iterate on copy and push nudges (“You have 2 bumps waiting”).
4. **Growth loops (Week 4+)**:
   - Referral codes for ambassadors (reward: early access to new features or merch).
   - QR posters at gyms/cafés with playful copy + `expo.dev` link.
   - Push notifications at 24 h mark plus reminder 12 h later if woman hasn’t decided.
5. **Metrics instrumentation**: Supabase analytics + PostHog/Segment to log onboarding funnel, visit success, bump creation, decisions, matches, reports.

## 13. Build Roadmap (6-week MVP)
| Week | Focus | Deliverables |
| --- | --- | --- |
| 1 | Auth & onboarding | Phone OTP, profile creation, storage uploads, location explainer screen |
| 2 | Places & geofencing | Nearby places API, client geofence service, visit logging pipeline |
| 3 | Bump job & woman feed | Cron job, repeat bump logic, bump card UI, dismissal persistence |
| 4 | Likes & matches | Woman “Send Ping”, man likes feed, match creation, notifications |
| 5 | Chat & safety | Real-time chats (Supabase Realtime), block/report flows, admin ban toggle |
| 6 | Polish & launch prep | Push campaigns, referral codes, analytics dashboards, ToS/Privacy rollout |

## 14. Stakeholder Clarifications
- **PWA fallback**: Defined as a Progressive Web App version that runs in the browser; intentionally excluded because Expo-native gives the background geofencing and push primitives we need.
- **Platform**: Ship the MVP exclusively with Expo (React Native) across iOS and Android.
- **Place sourcing**: Prefer integrating with Google Places (or similar) to keep the curated venue list fresh, with manual approval for safety.
- **Repeat bump policy**: A woman’s “No” permanently hides that man across future bumps until we ship a new override mechanic.
- **Ping decline visibility**: Women never get a notification if a man rejects a confirmed ping; the card simply disappears on his side.
- **Moderation SLA**: Minimal standard is 24-hour acknowledgement and 72-hour resolution per report.

All critical questions are now answered; teams can execute against this clarified MVP plan.

