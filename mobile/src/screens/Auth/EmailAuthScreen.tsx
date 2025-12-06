import { useMemo, useState } from 'react';
import {
  Alert,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.ladybugLayer}>
          {windowWidth > 0 && windowHeight > 0 && (
            <>
              <LadybugCrawler variant="red" areaWidth={windowWidth} areaHeight={windowHeight} size={78} />
              <LadybugCrawler variant="green" areaWidth={windowWidth} areaHeight={windowHeight} size={70} />
            </>
          )}
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <View style={styles.container}>
            <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.title}>Sign in to Bump Ping</Text>
              <Text style={styles.subtitle}>
                Use your email to receive a one-time verification code.
              </Text>
            </View>
            </View>

          {!otpSent ? (
            <View style={styles.card}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <PrimaryButton
                label="Send code"
                onPress={sendOtp}
                disabled={isSubmitting}
              />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Enter the 6-digit code</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
              />
              <PrimaryButton
                label="Verify"
                onPress={verifyOtp}
                disabled={isSubmitting}
              />
              <TouchableOpacity onPress={reset} style={styles.link}>
                <Text style={styles.linkText}>Wrong email? Start over.</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.terms}>
            By continuing you agree to our Terms & Privacy.
          </Text>
        </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
    zIndex: 1,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
    minHeight: 200,
    justifyContent: 'center',
  },
  heroContent: {
    gap: spacing.sm,
    maxWidth: 320,
  },
  ladybugLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.mutedText,
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
  label: {
    fontSize: typography.subheading,
    fontWeight: '600',
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
    color: colors.primary,
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
  },
});

export default EmailAuthScreen;

