import { supabase } from '../lib/supabaseClient';
import { MIN_VISIT_MINUTES } from '../location/constants';

type VisitPayload = {
  placeId: string;
  enterTime: string;
  exitTime: string;
};

export const recordVisit = async ({
  placeId,
  enterTime,
  exitTime,
}: VisitPayload) => {
  const durationMinutes =
    (new Date(exitTime).getTime() - new Date(enterTime).getTime()) / (1000 * 60);
  if (durationMinutes < MIN_VISIT_MINUTES) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    return;
  }

  const { error } = await supabase.from('visits').insert({
    user_id: userId,
    place_id: placeId,
    start_time: enterTime,
    end_time: exitTime,
  });

  if (error) {
    console.warn('Failed to record visit', error.message);
  }
};

