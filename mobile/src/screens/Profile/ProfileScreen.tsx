import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Linking, StyleSheet, Text, View, Switch, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { supabase } from '../../lib/supabaseClient';
import { env } from '../../config/env';
import { useAuthContext } from '../../providers/AuthProvider';
import { useUserStatus } from '../../hooks/useUserStatus';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

const ProfileScreen = () => {
  const { profile, session } = useAuthContext();
  const { isPaused, setPaused, isSettingPaused } = useUserStatus(session?.user.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const signOut = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Sign out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  const contactSupport = () => {
    if (!env.supportEmail) return;
    Linking.openURL(`mailto:${env.supportEmail}`);
  };

  const openLink = (url: string) => {
    if (!url) return;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.name}>{profile?.first_name ?? 'Your profile'}</Text>
        <Text style={styles.subtitle}>Control what others see</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visibility</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Pause bumping</Text>
            <Text style={styles.rowSubtitle}>
              Stop creating new bumps until you turn this off.
            </Text>
          </View>
          <Switch
            value={isPaused}
            onValueChange={setPaused}
            trackColor={{ true: colors.primary }}
            disabled={isSettingPaused}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.linkText}>Edit photos & bio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={contactSupport}>
          <Text style={styles.linkText}>Contact support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={signOut}>
          <Text style={[styles.linkText, { color: colors.danger }]}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => openLink(env.termsUrl)}>
          <Text style={styles.linkText}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => openLink(env.privacyUrl)}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  name: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: typography.caption,
    color: colors.mutedText,
  },
  linkRow: {
    paddingVertical: spacing.sm,
  },
  linkText: {
    fontSize: typography.body,
    fontWeight: '500',
    color: colors.primary,
  },
});

export default ProfileScreen;

