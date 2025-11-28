import { supabase } from '../lib/supabaseClient';

export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  city: string | null;
};

export const fetchActivePlaces = async (): Promise<Place[]> => {
  const { data, error } = await supabase
    .from('places')
    .select('id,name,lat,lng,category,city')
    .eq('is_active', true);

  if (error) {
    console.warn('Failed to fetch places', error.message);
    return [];
  }

  return (data ?? []) as Place[];
};

