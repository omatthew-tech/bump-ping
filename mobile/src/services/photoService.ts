import { supabase } from '../lib/supabaseClient';

const BUCKET = 'profile-photos';

const getFileExtension = (uri: string) => {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : 'jpg';
};

export const uploadProfilePhoto = async (
  fileUri: string,
  userId: string,
  position: number,
) => {
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const extension = getFileExtension(fileUri);
  const path = `${userId}/${Date.now()}-${position}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return {
    path,
    url: publicUrlData.publicUrl,
  };
};

export const replaceUserPhotos = async (
  userId: string,
  uris: string[],
) => {
  await supabase.from('photos').delete().eq('user_id', userId);

  const uploaded = await Promise.all(
    uris.map((uri, index) => uploadProfilePhoto(uri, userId, index + 1)),
  );

  const { error: insertError } = await supabase.from('photos').insert(
    uploaded.map((item, index) => ({
      user_id: userId,
      url: item.url,
      position: index + 1,
    })),
  );

  if (insertError) {
    throw insertError;
  }
};

