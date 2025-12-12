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
  termsUrl: requireEnv('EXPO_PUBLIC_TERMS_URL'),
  privacyUrl: requireEnv('EXPO_PUBLIC_PRIVACY_URL'),
  supportEmail: requireEnv('EXPO_PUBLIC_SUPPORT_EMAIL'),
};

