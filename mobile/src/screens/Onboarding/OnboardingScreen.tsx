import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/types';
import ProgressDots from '../../components/common/ProgressDots';
import PrimaryButton from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme';
import { INTEREST_OPTIONS } from '../../constants/interests';
import { supabase } from '../../lib/supabaseClient';
import { env } from '../../config/env';
import { useMutation } from '@tanstack/react-query';
import { useAuthContext } from '../../providers/AuthProvider';
import { replaceUserPhotos } from '../../services/photoService';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'> & {
  onComplete: () => void;
};

type Gender = 'woman' | 'man';
type Photo = {
  id: string;
  uri: string;
};

type FormState = {
  is18Plus: boolean;
  gender?: Gender;
  firstName: string;
  photos: Photo[];
  bio: string;
  interests: string[];
  locationGranted: boolean;
};

const INITIAL_FORM: FormState = {
  is18Plus: false,
  gender: undefined,
  firstName: '',
  photos: [],
  bio: '',
  interests: [],
  locationGranted: false,
};

const OnboardingScreen = ({ onComplete }: Props) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [step, setStep] = useState(0);
  const totalSteps = 5;
  const { session, refreshProfile } = useAuthContext();

  const createProfileMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: session.user.id,
        first_name: payload.firstName.trim(),
        gender: payload.gender,
        is_18_plus_confirmed: payload.is18Plus,
        bio: payload.bio,
        interests: payload.interests,
      });
      if (profileError) {
        console.error('profiles upsert failed', profileError);
        throw profileError;
      }

      try {
        await replaceUserPhotos(
          session.user.id,
          payload.photos.map((photo) => photo.uri),
        );
      } catch (photoError) {
        console.error('photo upload failed', photoError);
        throw photoError;
      }
    },
    onSuccess: async () => {
      await refreshProfile();
      onComplete();
    },
    onError: (err) => {
      console.error('onboarding mutation error', err);
      Alert.alert('Oops', 'We could not save your profile. Please try again.');
    },
  });

  const isCurrentStepValid = useMemo(() => {
    switch (step) {
      case 0:
        return form.is18Plus && !!form.gender;
      case 1:
        return form.firstName.trim().length >= 2;
      case 2:
        return form.photos.length >= 1;
      case 3:
        return form.interests.length >= 1;
      case 4:
        return form.locationGranted;
      default:
        return false;
    }
  }, [form, step]);

  const handleNext = () => {
    if (!isCurrentStepValid) {
      return;
    }

    if (step === totalSteps - 1) {
      createProfileMutation.mutate(form);
    } else {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const toggleInterest = (interest: string) => {
    setForm((prev) => {
      const exists = prev.interests.includes(interest);
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter((item) => item !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const handleAddPhoto = async () => {
    if (form.photos.length >= 3) {
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
      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, { id: asset.assetId ?? asset.uri, uri: asset.uri }],
      }));
    }
  };

  const removePhoto = (id: string) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((photo) => photo.id !== id),
    }));
  };

  const requestLocation = async () => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        Alert.alert('Permission needed', 'We need your permission to detect bumps at public places.');
        return;
      }
      const bg = await Location.requestBackgroundPermissionsAsync();
      const granted = bg.status === 'granted' || fg.status === 'granted';
      setForm((prev) => ({ ...prev, locationGranted: granted }));
      if (!granted) {
        Alert.alert('Almost there', 'Please allow background access so we can detect bumps.');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to request location access right now.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setForm((prev) => ({ ...prev, is18Plus: !prev.is18Plus }))}
            >
              <View style={[styles.checkbox, form.is18Plus && styles.checkboxChecked]}>
                {form.is18Plus && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>I confirm I am 18 or older.</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>I am a...</Text>
            <View style={styles.radioGroup}>
              {(['woman', 'man'] as Gender[]).map((value) => {
                const isActive = form.gender === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.radioChip, isActive && styles.radioChipActive]}
                    onPress={() => setForm((prev) => ({ ...prev, gender: value }))}
                  >
                    <Text style={[styles.radioText, isActive && styles.radioTextActive]}>
                      {value === 'woman' ? 'Woman' : 'Man'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>First name only</Text>
            <TextInput
              placeholder="First name"
              value={form.firstName}
              style={styles.input}
              onChangeText={(text) => setForm((prev) => ({ ...prev, firstName: text }))}
            />
            <Text style={styles.helperText}>We don’t show your last name or age.</Text>
          </View>
        );
      case 2:
        return (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Photos (1–3)</Text>
            <View style={styles.photoGrid}>
              {form.photos.map((photo) => (
                <View key={photo.id} style={styles.photoWrapper}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(photo.id)}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {form.photos.length < 3 && (
                <TouchableOpacity style={styles.addPhoto} onPress={handleAddPhoto}>
                  <Ionicons name="add" size={28} color={colors.primary} />
                  <Text style={styles.addPhotoText}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Tell us about yourself</Text>
            <TextInput
              placeholder="Optional bio"
              value={form.bio}
              onChangeText={(text) => setForm((prev) => ({ ...prev, bio: text }))}
              style={[styles.input, styles.bioInput]}
              multiline
              numberOfLines={4}
            />
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Tap your interests</Text>
            <View style={styles.chipGroup}>
              {INTEREST_OPTIONS.map((interest) => {
                const active = form.interests.includes(interest);
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
        );
      case 4:
        return (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Location permissions</Text>
            <Text style={styles.helperText}>
              We only track public spots (gyms, cafés, campus buildings). Men never see where the bump happened and we never share your live location.
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• We set geofences around approved public places.</Text>
              <Text style={styles.bullet}>• Only overlaps of 10+ minutes create bumps.</Text>
              <Text style={styles.bullet}>• Location data never shows up in chats.</Text>
            </View>
            <PrimaryButton
              label={form.locationGranted ? 'Location enabled ✅' : 'Allow location access'}
              onPress={requestLocation}
              disabled={form.locationGranted}
            />
            <Text style={styles.termsText}>
              By continuing you agree to our{' '}
              <Text style={styles.link} onPress={() => Linking.openURL(env.termsUrl)}>
                Terms
              </Text>{' '}
              &{' '}
              <Text style={styles.link} onPress={() => Linking.openURL(env.privacyUrl)}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  const titles = [
    { title: 'Age & gender', subtitle: 'Woman-first experience starts here.' },
    { title: 'First name', subtitle: 'No last names, keep it casual.' },
    { title: 'Photos', subtitle: 'Upload 1–3 recent photos.' },
    { title: 'Bio & interests', subtitle: 'Give them an easy icebreaker.' },
    { title: 'Location explainer', subtitle: 'We only track approved public places.' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{titles[step].title}</Text>
        <Text style={styles.subtitle}>{titles[step].subtitle}</Text>
        <ProgressDots total={totalSteps} currentIndex={step} />
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <PrimaryButton variant="secondary" label="Back" onPress={handleBack} style={{ flex: 1 }} />
        )}
        <PrimaryButton
          label={step === totalSteps - 1 ? (createProfileMutation.isPending ? 'Finishing…' : 'Start bumping') : 'Continue'}
          onPress={handleNext}
          disabled={!isCurrentStepValid || createProfileMutation.isPending}
          style={{ flex: 2 }}
        />
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
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  helperText: {
    fontSize: typography.caption,
    color: colors.mutedText,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: typography.body,
    color: colors.text,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  radioChip: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  radioChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radioText: {
    color: colors.text,
    fontWeight: '600',
  },
  radioTextActive: {
    color: colors.surface,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: typography.body,
    backgroundColor: colors.surface,
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
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
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
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
  bulletList: {
    gap: spacing.xs,
  },
  bullet: {
    fontSize: typography.body,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  termsText: {
    fontSize: typography.caption,
    color: colors.mutedText,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default OnboardingScreen;

