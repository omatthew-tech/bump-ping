import { supabase } from '../lib/supabaseClient';

export const blockUser = async (blockerId: string, blockedId: string) => {
  const { error } = await supabase.from('blocks').upsert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error) {
    throw new Error(error.message);
  }
};

export const reportUser = async (reporterId: string, reportedId: string, reason: string) => {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    reason,
  });
  if (error) {
    throw new Error(error.message);
  }
};

export const fetchBlockedUserIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id,blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) {
    console.warn('Failed to load blocks', error.message);
    return [];
  }

  const ids = new Set<string>();
  (data ?? []).forEach((row) => {
    if (row.blocker_id === userId) {
      ids.add(row.blocked_id);
    } else if (row.blocked_id === userId) {
      ids.add(row.blocker_id);
    }
  });
  return Array.from(ids);
};

