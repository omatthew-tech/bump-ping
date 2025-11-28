import { View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '../../theme';
import { useAuthContext } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabaseClient';

type WomanBumpCard = {
  id: string;
  manId: string;
  name: string;
  place: string;
  bumpedAtLabel: string;
  repeatCount: number;
  photo?: string;
};

type IncomingLikeCard = {
  likeId: string;
  womanId: string;
  bumpId: string;
  name: string;
  place: string;
  createdAtLabel: string;
  photo?: string;
};

const formatRelativeLabel = (timestamp: string) => {
  const date = new Date(timestamp);
  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours < 2) return 'just now';
  if (diffHours < 24) return 'today';
  if (diffHours < 48) return 'yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const fetchWomanBumps = async (userId: string): Promise<WomanBumpCard[]> => {
  const now = new Date().toISOString();
  const { data: bumps, error } = await supabase
    .from('bumps')
    .select('id,man_id,place:places(name),repeat_count,bumped_at')
    .eq('woman_id', userId)
    .lte('visible_to_woman_at', now)
    .order('bumped_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!bumps?.length) return [];

  const manIds = Array.from(new Set(bumps.map((b) => b.man_id)));
  const { data: likes } = await supabase
    .from('likes')
    .select('to_user_id')
    .eq('from_user_id', userId);

  const dismissed = new Set((likes ?? []).map((l) => l.to_user_id));
  const filtered = bumps.filter((b) => !dismissed.has(b.man_id));
  if (!filtered.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,first_name')
    .in('user_id', manIds);
  if (profileError) {
    throw new Error(profileError.message);
  }
  const { data: photos } = await supabase
    .from('photos')
    .select('user_id,url,position')
    .in('user_id', manIds)
    .order('position');

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
  const photoMap = new Map<string, string | undefined>();
  (photos ?? []).forEach((photo) => {
    if (!photoMap.has(photo.user_id) && photo.position === 1) {
      photoMap.set(photo.user_id, photo.url);
    }
  });

  return filtered.map((bump) => ({
    id: bump.id,
    manId: bump.man_id,
    name: profileMap.get(bump.man_id)?.first_name ?? 'Someone',
    place: (bump.place as { name?: string } | null)?.name ?? 'somewhere nearby',
    bumpedAtLabel: formatRelativeLabel(bump.bumped_at),
    repeatCount: bump.repeat_count ?? 1,
    photo: photoMap.get(bump.man_id),
  }));
};

const fetchIncomingLikes = async (userId: string): Promise<IncomingLikeCard[]> => {
  const { data: likes, error } = await supabase
    .from('likes')
    .select('id,from_user_id,bump_id,created_at')
    .eq('to_user_id', userId)
    .eq('decision', 'yes')
    .eq('is_confirmed', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!likes?.length) return [];

  const womanIds = Array.from(new Set(likes.map((l) => l.from_user_id)));
  const bumpIds = Array.from(new Set(likes.map((l) => l.bump_id)));

  const [{ data: profiles }, { data: photos }, { data: bumps }] = await Promise.all([
    supabase.from('profiles').select('user_id,first_name').in('user_id', womanIds),
    supabase.from('photos').select('user_id,url,position').in('user_id', womanIds).order('position'),
    supabase.from('bumps').select('id,place:places(name)').in('id', bumpIds),
  ]);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
  const bumpMap = new Map(bumps?.map((b) => [b.id, b]));
  const photoMap = new Map<string, string | undefined>();
  (photos ?? []).forEach((photo) => {
    if (!photoMap.has(photo.user_id) && photo.position === 1) {
      photoMap.set(photo.user_id, photo.url);
    }
  });

  return likes.map((like) => ({
    likeId: like.id,
    womanId: like.from_user_id,
    bumpId: like.bump_id ?? '',
    name: profileMap.get(like.from_user_id)?.first_name ?? 'Someone',
    place: (bumpMap.get(like.bump_id ?? '')?.place as { name?: string } | null)?.name ?? 'a nearby spot',
    createdAtLabel: formatRelativeLabel(like.created_at),
    photo: photoMap.get(like.from_user_id),
  }));
};

const WomanBumpCard = ({
  bump,
  onDecision,
  isProcessing,
}: {
  bump: WomanBumpCard;
  onDecision: (action: 'no' | 'yes') => void;
  isProcessing: boolean;
}) => (
  <View style={styles.card}>
    {bump.photo ? (
      <ImageBackground source={{ uri: bump.photo }} style={styles.photo} imageStyle={{ borderRadius: 16 }}>
        {bump.repeatCount > 1 && (
          <View style={styles.repeatBadge}>
            <Text style={styles.repeatText}>Crossed paths {bump.repeatCount}× 👀</Text>
          </View>
        )}
      </ImageBackground>
    ) : (
      <View style={[styles.photo, styles.photoPlaceholder]}>
        <Text style={styles.placeholderInitial}>{bump.name[0]}</Text>
      </View>
    )}
    <View style={styles.info}>
      <Text style={styles.name}>{bump.name}</Text>
      <Text style={styles.context}>
        You bumped near {bump.place} {bump.bumpedAtLabel}.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.noButton]}
          onPress={() => onDecision('no')}
          disabled={isProcessing}
        >
          <Text style={[styles.buttonText, styles.noText]}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.yesButton]}
          onPress={() => onDecision('yes')}
          disabled={isProcessing}
        >
          <Text style={styles.buttonText}>{isProcessing ? 'Sending…' : 'Send Ping'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const IncomingLikeCardComponent = ({
  like,
  onRespond,
  isProcessing,
}: {
  like: IncomingLikeCard;
  onRespond: (action: 'no' | 'match') => void;
  isProcessing: boolean;
}) => (
  <View style={styles.card}>
    {like.photo ? (
      <ImageBackground source={{ uri: like.photo }} style={styles.photo} imageStyle={{ borderRadius: 16 }} />
    ) : (
      <View style={[styles.photo, styles.photoPlaceholder]}>
        <Text style={styles.placeholderInitial}>{like.name[0]}</Text>
      </View>
    )}
    <View style={styles.info}>
      <Text style={styles.name}>{like.name}</Text>
      <Text style={styles.context}>
        Someone you crossed paths with near {like.place} likes you ({like.createdAtLabel}).
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.noButton]}
          onPress={() => onRespond('no')}
          disabled={isProcessing}
        >
          <Text style={[styles.buttonText, styles.noText]}>No thanks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.yesButton]}
          onPress={() => onRespond('match')}
          disabled={isProcessing}
        >
          <Text style={styles.buttonText}>{isProcessing ? 'Matching…' : 'Match'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const BumpsScreen = () => {
  const { session, profile } = useAuthContext();
  const userId = session?.user.id;
  const isWoman = profile?.gender === 'woman';
  const queryClient = useQueryClient();

  const bumpsQuery = useQuery({
    queryKey: ['bumps', userId],
    queryFn: () => fetchWomanBumps(userId ?? ''),
    enabled: !!userId && isWoman,
  });

  const likesQuery = useQuery({
    queryKey: ['incomingLikes', userId],
    queryFn: () => fetchIncomingLikes(userId ?? ''),
    enabled: !!userId && profile?.gender === 'man',
  });

  const womanDecisionMutation = useMutation({
    mutationFn: async ({ manId, decision, bumpId }: { manId: string; decision: 'no' | 'yes'; bumpId: string }) => {
      if (!userId) throw new Error('Missing user');
      const payload = {
        from_user_id: userId,
        to_user_id: manId,
        bump_id: bumpId,
        decision,
        is_confirmed: decision === 'yes',
      };
      const { error } = await supabase.from('likes').insert(payload);
      if (error) throw new Error(error.message);
    },
    onError: (err) => Alert.alert('Error', err.message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bumps', userId] }),
  });

  const likeResponseMutation = useMutation({
    mutationFn: async ({
      likeId,
      bumpId,
      womanId,
      action,
    }: {
      likeId: string;
      bumpId: string;
      womanId: string;
      action: 'no' | 'match';
    }) => {
      if (!userId) throw new Error('Missing user');
      if (action === 'no') {
        const { error } = await supabase.from('likes').delete().eq('id', likeId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error: matchError } = await supabase.from('matches').insert({
        user_a_id: womanId,
        user_b_id: userId,
        bump_id: bumpId,
      });
      if (matchError) throw new Error(matchError.message);
      await supabase.from('likes').delete().eq('id', likeId);
    },
    onError: (err) => Alert.alert('Error', err.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomingLikes', userId] });
      queryClient.invalidateQueries({ queryKey: ['matches', userId] });
    },
  });

  const renderWomanFeed = () => {
    if (bumpsQuery.isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!bumpsQuery.data?.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No bumps yet</Text>
          <Text style={styles.emptySubtitle}>Give it 24 hours after you visit public spots.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={bumpsQuery.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <WomanBumpCard
            bump={item}
            isProcessing={womanDecisionMutation.isPending}
            onDecision={(decision) => womanDecisionMutation.mutate({ manId: item.manId, decision, bumpId: item.id })}
          />
        )}
      />
    );
  };

  const renderManFeed = () => {
    if (likesQuery.isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!likesQuery.data?.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No likes yet</Text>
          <Text style={styles.emptySubtitle}>We’ll notify you when someone sends a ping.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={likesQuery.data}
        keyExtractor={(item) => item.likeId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <IncomingLikeCardComponent
            like={item}
            isProcessing={likeResponseMutation.isPending}
            onRespond={(action) =>
              likeResponseMutation.mutate({
                likeId: item.likeId,
                bumpId: item.bumpId,
                womanId: item.womanId,
                action,
              })
            }
          />
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Text style={styles.title}>
        {isWoman ? 'Bumps waiting on you' : 'Someone likes you'}
      </Text>
      {isWoman ? renderWomanFeed() : renderManFeed()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: spacing.md,
  },
  photo: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  photoPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInitial: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.mutedText,
  },
  repeatBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 12,
  },
  repeatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  info: {
    gap: spacing.sm,
  },
  name: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.text,
  },
  context: {
    fontSize: typography.body,
    color: colors.mutedText,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    alignItems: 'center',
  },
  noButton: {
    backgroundColor: colors.border,
  },
  yesButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.surface,
  },
  noText: {
    color: colors.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
});

export default BumpsScreen;

