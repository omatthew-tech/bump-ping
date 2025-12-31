import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';

type BlockRequest = {
  blockedId?: string;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return json({ error: 'Missing Supabase credentials' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    return json({ error: 'Missing auth token' }, 401);
  }

  let body: BlockRequest;
  try {
    body = (await req.json()) as BlockRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const blockedId = body.blockedId?.trim();
  if (!blockedId) {
    return json({ error: 'Missing blockedId' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const blockerId = userData.user.id;

  // 1) Record the block (one-way).
  const { error: blockError } = await supabase.from('blocks').upsert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (blockError) {
    return json({ error: blockError.message }, 400);
  }

  // 2) Find any matches between the two users.
  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select('id')
    .or(
      `and(user_a_id.eq.${blockerId},user_b_id.eq.${blockedId}),and(user_a_id.eq.${blockedId},user_b_id.eq.${blockerId})`,
    );
  if (matchError) {
    return json({ error: matchError.message }, 400);
  }

  const matchIds = (matches ?? []).map((m) => m.id).filter(Boolean) as string[];
  if (!matchIds.length) {
    return json({ ok: true, deleted: { matches: 0, messages: 0 } }, 200);
  }

  // 3) Delete messages, then matches (so chat disappears for BOTH users).
  const { error: messageDeleteError, count: messagesDeleted } = await supabase
    .from('messages')
    .delete({ count: 'exact' })
    .in('match_id', matchIds);
  if (messageDeleteError) {
    return json({ error: messageDeleteError.message }, 400);
  }

  const { error: matchDeleteError, count: matchesDeleted } = await supabase
    .from('matches')
    .delete({ count: 'exact' })
    .in('id', matchIds);
  if (matchDeleteError) {
    return json({ error: matchDeleteError.message }, 400);
  }

  return json({
    ok: true,
    deleted: {
      matches: matchesDeleted ?? matchIds.length,
      messages: messagesDeleted ?? null,
    },
  });
});


