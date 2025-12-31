import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';

type VisitRow = {
  id: string;
  user_id: string;
  place_id: string;
  start_time: string;
  end_time: string;
};

type BumpCandidate = {
  womanId: string;
  manId: string;
  placeId: string;
  overlapMinutes: number;
  bumpedAt: string;
  repeatGain: number;
};

const LOOKBACK_HOURS = 36;
const MIN_OVERLAP_MINUTES = 10;
// Bumps are eligible for the woman to review immediately (no 24h delay).
const VISIBILITY_DELAY_MS = 0;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;

const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

type PushTokenRow = {
  token: string;
};

const sendExpoPush = async (tokens: string[], title: string, body: string) => {
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data: { kind: 'new_bump' },
  }));

  const batches = chunk(messages, EXPO_BATCH_SIZE);
  for (const batch of batches) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Expo push failed', res.status, text);
      continue;
    }

    const json = await res.json().catch(() => null);
    // Expo returns per-message errors; log if present for visibility.
    if (json?.data?.some?.((d: { status?: string }) => d?.status === 'error')) {
      console.warn('Expo push response contained errors', JSON.stringify(json));
    }
  }
};

const getOverlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  const durationMs = end - start;
  if (durationMs <= 0) return 0;
  return Math.floor(durationMs / (60 * 1000));
};

const midpoint = (start: Date, end: Date) => new Date((start.getTime() + end.getTime()) / 2);

serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase credentials' }),
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const lookbackSince = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: visits, error } = await supabase
    .from('visits')
    .select('id,user_id,place_id,start_time,end_time')
    .gte('start_time', lookbackSince);

  if (error) {
    console.error('Failed to fetch visits', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const userIds = Array.from(new Set((visits ?? []).map((visit) => visit.user_id)));
  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id,gender')
    .in('user_id', userIds);

  if (profilesError) {
    console.error('Failed to fetch profiles', profilesError);
    return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
  }

  const genderMap = new Map((profileRows ?? []).map((profile) => [profile.user_id, profile.gender]));

  const placeMap = new Map<string, { women: VisitRow[]; men: VisitRow[] }>();
  (visits ?? []).forEach((visit) => {
    const gender = genderMap.get(visit.user_id);
    if (!gender) return;
    const entry = placeMap.get(visit.place_id) ?? { women: [], men: [] };
    if (gender === 'woman') {
      entry.women.push(visit);
    } else {
      entry.men.push(visit);
    }
    placeMap.set(visit.place_id, entry);
  });

  const candidates = new Map<string, BumpCandidate>();

  for (const [placeId, grouped] of placeMap.entries()) {
    grouped.women.forEach((womanVisit) => {
      grouped.men.forEach((manVisit) => {
        const overlapMinutes = getOverlapMinutes(
          new Date(womanVisit.start_time),
          new Date(womanVisit.end_time),
          new Date(manVisit.start_time),
          new Date(manVisit.end_time),
        );

        if (overlapMinutes < MIN_OVERLAP_MINUTES) return;

        const bumpTime = midpoint(
          new Date(womanVisit.start_time),
          new Date(manVisit.end_time),
        ).toISOString();

        const key = `${womanVisit.user_id}:${manVisit.user_id}`;
        const current = candidates.get(key);
        if (current) {
          if (new Date(bumpTime).getTime() > new Date(current.bumpedAt).getTime()) {
            candidates.set(key, {
              ...current,
              placeId,
              overlapMinutes,
              bumpedAt: bumpTime,
              repeatGain: current.repeatGain + 1,
            });
          } else {
            candidates.set(key, {
              ...current,
              repeatGain: current.repeatGain + 1,
            });
          }
        } else {
          candidates.set(key, {
            womanId: womanVisit.user_id,
            manId: manVisit.user_id,
            placeId,
            overlapMinutes,
            bumpedAt: bumpTime,
            repeatGain: 1,
          });
        }
      });
    });
  }

  const results = [];
  const newlyInsertedForWomen = new Set<string>();

  for (const candidate of candidates.values()) {
    const { data: existing } = await supabase
      .from('bumps')
      .select('id,repeat_count,bumped_at')
      .eq('woman_id', candidate.womanId)
      .eq('man_id', candidate.manId)
      .maybeSingle();

    const candidateTime = new Date(candidate.bumpedAt).getTime();
    const visibility = new Date(candidateTime + VISIBILITY_DELAY_MS).toISOString();

    if (existing && candidateTime <= new Date(existing.bumped_at).getTime()) {
      continue;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('bumps')
        .update({
          place_id: candidate.placeId,
          overlap_minutes: candidate.overlapMinutes,
          repeat_count: (existing.repeat_count ?? 1) + candidate.repeatGain,
          bumped_at: candidate.bumpedAt,
          visible_to_woman_at: visibility,
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Failed to update bump', updateError);
        continue;
      }
      results.push({ type: 'updated', womanId: candidate.womanId, manId: candidate.manId });
    } else {
      const { error: insertError } = await supabase.from('bumps').insert({
        woman_id: candidate.womanId,
        man_id: candidate.manId,
        place_id: candidate.placeId,
        overlap_minutes: candidate.overlapMinutes,
        repeat_count: candidate.repeatGain,
        bumped_at: candidate.bumpedAt,
        visible_to_woman_at: visibility,
      });
      if (insertError) {
        console.error('Failed to insert bump', insertError);
        continue;
      }
      results.push({ type: 'inserted', womanId: candidate.womanId, manId: candidate.manId });
      newlyInsertedForWomen.add(candidate.womanId);
    }
  }

  // Push notification: only for brand new bumps (inserts).
  try {
    const womanIds = Array.from(newlyInsertedForWomen);
    if (womanIds.length) {
      const { data: tokenRows, error: tokenError } = await supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', womanIds);

      if (tokenError) {
        console.error('Failed to fetch push tokens', tokenError);
      } else {
        const tokens = ((tokenRows ?? []) as PushTokenRow[]).map((r) => r.token).filter(Boolean);
        await sendExpoPush(tokens, 'Someone just bumped you', 'See who it is');
      }
    }
  } catch (err) {
    console.error('Push notification sending failed', err);
  }

  return new Response(JSON.stringify({ processed: results.length, details: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

