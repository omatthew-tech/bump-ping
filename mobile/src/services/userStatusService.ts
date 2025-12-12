import { supabase } from '../lib/supabaseClient';

export type UserStatus = {
  user_id: string;
  is_paused: boolean;
  is_banned?: boolean;
};

export const fetchUserStatus = async (userId: string): Promise<UserStatus | null> => {
  const { data, error } = await supabase
    .from('user_status')
    .select('user_id,is_paused,is_banned')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load user status', error.message);
    return null;
  }
  return (data as UserStatus) ?? null;
};

export const setPauseStatus = async (userId: string, isPaused: boolean) => {
  const { error } = await supabase.from('user_status').upsert({
    user_id: userId,
    is_paused: isPaused,
  });
  if (error) {
    throw new Error(error.message);
  }
};

