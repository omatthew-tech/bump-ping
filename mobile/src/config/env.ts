const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Missing environment variable: ${key}`);
  }
  return value ?? '';
};

export const env = {
  supabaseUrl: requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};

