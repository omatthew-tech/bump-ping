import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/common/PrimaryButton';
import LadybugCrawler from '../../components/common/LadybugCrawler';
import { colors, spacing, typography } from '../../theme';
import { supabase } from '../../lib/supabaseClient';
import { env } from '../../config/env';

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const EmailAuthScreen = () => {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [bugArea, setBugArea] = useState({ width: 0, height: 0 });

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const sendOtp = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      setOtpSent(true);
    } catch (err) {
      setError('Failed to send code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    if (otp.length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      Alert.alert('Welcome', 'Email verified!');
    } catch (err) {
      setError('Could not verify code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setOtp('');
    setOtpSent(false);
  };

  const openLink = async (url: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Please try again later.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View
          pointerEvents="none"
          style={styles.ladybugLayer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setBugArea((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
          }}
        >
          {(bugArea.width || windowWidth) > 0 && (bugArea.height || windowHeight) > 0 && (
            <>
              <LadybugCrawler
                variant="red"
                areaWidth={bugArea.width || windowWidth}
                areaHeight={bugArea.height || windowHeight}
                size={78}
              />
              <LadybugCrawler
                variant="green"
                areaWidth={bugArea.width || windowWidth}
                areaHeight={bugArea.height || windowHeight}
                size={70}
              />
            </>
          )}
        </View>

        <View style={styles.brandArea}>
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkBump}>bump</Text>
            <Text style={styles.wordmarkPing}>Ping</Text>
          </View>
        </View>

        <View style={styles.bottomArea}>
          {!otpSent ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign up / log in with email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.mutedText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <PrimaryButton label="Send code" onPress={sendOtp} disabled={isSubmitting} />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enter the 6-digit code</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
              />
              <PrimaryButton label="Verify" onPress={verifyOtp} disabled={isSubmitting} />
              <TouchableOpacity onPress={reset} style={styles.link}>
                <Text style={styles.linkText}>Wrong email? Start over.</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.terms}>
            By continuing you agree to our{' '}
            <Text style={styles.linkInline} onPress={() => openLink(env.termsUrl)}>
              Terms
            </Text>{' '}
            &{' '}
            <Text style={styles.linkInline} onPress={() => openLink(env.privacyUrl)}>
              Privacy
            </Text>
            .
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  ladybugLayer: {
    ...StyleSheet.absoluteFillObject,
    // Above the wordmark so bugs can crawl over it.
    zIndex: 2,
  },
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xl * 2,
    // Below the ladybugs (they should crawl over the logo text).
    zIndex: 1,
  },
  wordmark: {
    alignItems: 'center',
    // Extra breathing room to avoid ascender clipping (the top of "b") on some devices.
    paddingTop: 14,
    paddingBottom: 10,
  },
  wordmarkBump: {
    fontFamily: 'Baloo2_700Bold',
    fontSize: 74,
    lineHeight: 94,
    color: colors.text,
    letterSpacing: -1.5,
  },
  wordmarkPing: {
    fontFamily: 'Baloo2_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    letterSpacing: 6,
    marginTop: -22,
  },
  bottomArea: {
    gap: spacing.md,
    // Keep the form above the ladybugs for usability.
    zIndex: 3,
    paddingBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: typography.body,
    backgroundColor: colors.surface,
  },
  link: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  terms: {
    fontSize: typography.caption,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkInline: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default EmailAuthScreen;

