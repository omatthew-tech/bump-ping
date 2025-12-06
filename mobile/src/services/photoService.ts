import { File } from 'expo-file-system';
import { supabase } from '../lib/supabaseClient';

const BUCKET = 'profile-photos';

const getFileExtension = (uri: string) => {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : 'jpg';
};

const getMimeType = (extension: string) => {
  switch (extension.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg';
  }
};

export const uploadProfilePhoto = async (
  fileUri: string,
  userId: string,
  position: number,
) => {
  const extension = getFileExtension(fileUri);
  const path = `${userId}/${Date.now()}-${position}.${extension}`;
  const file = new File(fileUri);
  const fileBuffer = await file.arrayBuffer();
  const contentType = getMimeType(extension);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      cacheControl: '3600',
      upsert: true,
      contentType,
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

