import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme';
import { supabase } from '../../lib/supabaseClient';

const formatPhone = (value: string) => {
  const trimmed = value.replace(/[^\d+]/g, '');
  if (!trimmed.startsWith('+')) {
    return `+1${trimmed}`;
  }
  return trimmed;
};

const PhoneAuthScreen = () => {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedPhone = useMemo(() => formatPhone(phone), [phone]);

  const sendOtp = async () => {
    setError(null);
    if (formattedPhone.length < 10) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
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
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      Alert.alert('Welcome', 'Phone verified!');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Sign in to Bump Ping</Text>
          <Text style={styles.subtitle}>
            Phone verification keeps the community real and safe.
          </Text>

          {!otpSent ? (
            <View style={styles.card}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 415 222 3333"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
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
                <Text style={styles.linkText}>Wrong number? Start over.</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.terms}>
            By continuing you agree to our Terms & Privacy.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
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

export default PhoneAuthScreen;

