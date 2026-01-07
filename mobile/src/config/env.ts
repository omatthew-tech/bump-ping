const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Missing environment variable: ${key}`);
  }
  return value ?? '';
};

const defaultPublic = {
  termsUrl: 'https://bump-ping.com/terms',
  privacyUrl: 'https://bump-ping.com/privacy',
  supportEmail: 'support@bump-ping.com',
} as const;

export const env = {
  supabaseUrl: requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  termsUrl: requireEnv('EXPO_PUBLIC_TERMS_URL') || defaultPublic.termsUrl,
  privacyUrl: requireEnv('EXPO_PUBLIC_PRIVACY_URL') || defaultPublic.privacyUrl,
  supportEmail: requireEnv('EXPO_PUBLIC_SUPPORT_EMAIL') || defaultPublic.supportEmail,
};

