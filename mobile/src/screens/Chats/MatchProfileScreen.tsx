import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View, ActivityIndicator, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabaseClient';
import { useAuthContext } from '../../providers/AuthProvider';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MatchProfile'>;

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  bio: string | null;
  interests: string[] | null;
};

type PhotoRow = {
  url: string;
  position: number | null;
};

type MatchProfileData = {
  name: string;
  bio: string | null;
  interests: string[];
  photos: string[];
  matchedPlace: string | null;
};

const fetchMatchProfile = async (matchId: string, viewerId: string): Promise<MatchProfileData> => {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id,user_a_id,user_b_id,bump_id')
    .eq('id', matchId)
    .maybeSingle();

  if (matchError) throw new Error(matchError.message);
  if (!match) throw new Error('Match not found');

  const otherUserId = match.user_a_id === viewerId ? match.user_b_id : match.user_a_id;
  const bumpId = match.bump_id as string | null;

  const [{ data: profile, error: profileError }, { data: photos, error: photosError }, { data: bumpRow }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('user_id,first_name,bio,interests')
        .eq('user_id', otherUserId)
        .maybeSingle(),
      supabase
        .from('photos')
        .select('url,position')
        .eq('user_id', otherUserId)
        .order('position'),
      bumpId
        ? supabase.from('bumps').select('id,place:places(name)').eq('id', bumpId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (profileError) throw new Error(profileError.message);
  if (photosError) throw new Error(photosError.message);

  const name = (profile as ProfileRow | null)?.first_name ?? 'Match';
  const bio = (profile as ProfileRow | null)?.bio ?? null;
  const interests = ((profile as ProfileRow | null)?.interests ?? []) as string[];
  const orderedPhotos = (photos as PhotoRow[] | null) ?? [];
  const photoUrls = orderedPhotos.map((p) => p.url).filter(Boolean);
  const matchedPlace =
    ((bumpRow?.data?.place as { name?: string } | null)?.name as string | undefined) ?? null;

  return {
    name,
    bio,
    interests,
    photos: photoUrls,
    matchedPlace,
  };
};

const MatchProfileScreen = ({ route }: Props) => {
  const { matchId } = route.params;
  const { session } = useAuthContext();
  const viewerId = session?.user.id ?? '';

  const query = useQuery({
    queryKey: ['matchProfile', matchId],
    queryFn: () => fetchMatchProfile(matchId, viewerId),
    enabled: !!matchId && !!viewerId,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn’t load profile</Text>
          <Text style={styles.errorSubtitle}>Please try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { name, bio, interests, photos, matchedPlace } = query.data;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        {!!matchedPlace && <Text style={styles.subtitle}>Matched near {matchedPlace}</Text>}
      </View>

      {!!photos.length && (
        <FlatList
          data={photos}
          keyExtractor={(item, idx) => `${item}-${idx}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
          renderItem={({ item }) => <Image source={{ uri: item }} style={styles.photo} />}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bio</Text>
        <Text style={styles.body}>{bio?.trim() ? bio : 'No bio yet.'}</Text>

        {!!interests.length && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Interests</Text>
            <Text style={styles.body}>{interests.join(' • ')}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body,
    color: colors.mutedText,
  },
  photoRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  photo: {
    width: 180,
    height: 260,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: typography.body,
    color: colors.text,
  },
  errorTitle: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: typography.body,
    color: colors.mutedText,
  },
});

export default MatchProfileScreen;


