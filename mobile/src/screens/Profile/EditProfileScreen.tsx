import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '../../theme';
import { INTEREST_OPTIONS } from '../../constants/interests';
import { supabase } from '../../lib/supabaseClient';
import { useAuthContext } from '../../providers/AuthProvider';
import { replaceUserPhotos } from '../../services/photoService';
import { RootStackParamList } from '../../navigation/types';
import PrimaryButton from '../../components/common/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

type Photo = {
  id: string;
  uri: string;
};

const EditProfileScreen = ({ navigation }: Props) => {
  const { session, profile, refreshProfile } = useAuthContext();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    const loadPhotos = async () => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('photos')
        .select('url,position')
        .eq('user_id', userId)
        .order('position');
      if (error) {
        console.warn('Failed to load photos', error.message);
        return;
      }
      setPhotos(
        (data ?? []).map((row) => ({
          id: row.url,
          uri: row.url,
        })),
      );
    };
    loadPhotos();
  }, [userId]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  };

  const handleAddPhoto = async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit reached', 'You can upload up to 3 photos for now.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your camera roll to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPhotos((prev) => [...prev, { id: asset.assetId ?? asset.uri, uri: asset.uri }]);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const isSaveEnabled = useMemo(
    () => firstName.trim().length >= 2 && interests.length >= 1 && photos.length >= 1,
    [firstName, interests, photos],
  );

  const handleSave = async () => {
    if (!userId) return;
    if (!isSaveEnabled) {
      Alert.alert('Missing info', 'Add at least one photo, one interest, and a first name.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        first_name: firstName.trim(),
        bio,
        interests,
      }).eq('user_id', userId);
      if (error) throw error;

      await replaceUserPhotos(userId, photos.map((p) => p.uri));
      await refreshProfile();
      Alert.alert('Saved', 'Your profile was updated.');
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit profile</Text>
          <Text style={styles.subtitle}>Keep it current so bumps feel real.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>First name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about you"
            multiline
            numberOfLines={4}
            style={[styles.input, styles.bioInput]}
          />
          <Text style={styles.helper}>Short and sweet works best.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Interests</Text>
          <View style={styles.chipGroup}>
            {INTEREST_OPTIONS.map((interest) => {
              const active = interests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{interest}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Photos (1–3)</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(photo.id)}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 3 && (
              <TouchableOpacity style={styles.addPhoto} onPress={handleAddPhoto}>
                <Ionicons name="add" size={28} color={colors.primary} />
                <Text style={styles.addPhotoText}>Add photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={isSaving ? 'Saving…' : 'Save changes'}
          onPress={handleSave}
          disabled={!isSaveEnabled || isSaving}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: typography.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helper: {
    color: colors.mutedText,
    fontSize: typography.caption,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.text,
  },
  chipLabelActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 110,
    height: 160,
    borderRadius: 18,
  },
  removePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 110,
    height: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addPhotoText: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.mutedText,
    fontWeight: '600',
  },
});

export default EditProfileScreen;

