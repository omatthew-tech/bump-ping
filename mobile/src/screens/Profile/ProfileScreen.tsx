import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, Switch, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '../../theme';

const ProfileScreen = () => {
  const [pauseBumping, setPauseBumping] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.name}>Your profile</Text>
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
            value={pauseBumping}
            onValueChange={setPauseBumping}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.linkRow}>
          <Text style={styles.linkText}>Edit photos & bio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow}>
          <Text style={styles.linkText}>Referral code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.danger }]}>Delete account</Text>
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

