import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, ActivityIndicator, Alert, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '../../theme';
import { useAuthContext } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabaseClient';
import { fetchBlockedUserIds, blockUser, reportUser } from '../../services/safetyService';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';

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

const fetchWomanBumps = async (userId: string, blockedIds: string[]): Promise<WomanBumpCard[]> => {
  const { data: bumps, error } = await supabase
    .from('bumps')
    .select('id,man_id,place:places(name),repeat_count,bumped_at')
    .eq('woman_id', userId)
    .order('bumped_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!bumps?.length) return [];

  const manIds = Array.from(new Set(bumps.map((b) => b.man_id)));

  // Filter out anyone we've already matched with.
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('user_a_id,user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const matchedIds = new Set<string>();
  (existingMatches ?? []).forEach((m) => {
    const other = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
    if (other) matchedIds.add(other);
  });

  const { data: likes } = await supabase
    .from('likes')
    .select('to_user_id')
    .eq('from_user_id', userId);

  const dismissed = new Set((likes ?? []).map((l) => l.to_user_id));
  const filtered = bumps.filter(
    (b) =>
      !dismissed.has(b.man_id) &&
      !blockedIds.includes(b.man_id) &&
      !matchedIds.has(b.man_id),
  );
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
  // Pick ONLY the first photo per user (lowest `position`).
  const photoMap = new Map<string, { position: number; url?: string }>();
  (photos ?? []).forEach((photo) => {
    const position = typeof photo.position === 'number' ? photo.position : 9999;
    const existing = photoMap.get(photo.user_id);
    if (!existing || position < existing.position) {
      photoMap.set(photo.user_id, { position, url: photo.url });
    }
  });

  return filtered.map((bump) => ({
    id: bump.id,
    manId: bump.man_id,
    name: profileMap.get(bump.man_id)?.first_name ?? 'Someone',
    place: (bump.place as { name?: string } | null)?.name ?? 'somewhere nearby',
    bumpedAtLabel: formatRelativeLabel(bump.bumped_at),
    repeatCount: bump.repeat_count ?? 1,
    photo: photoMap.get(bump.man_id)?.url,
  }));
};

const fetchIncomingLikes = async (userId: string, blockedIds: string[]): Promise<IncomingLikeCard[]> => {
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

  // If we already matched with someone, never show them again in the bumps feed.
  const { data: matches } = await supabase
    .from('matches')
    .select('user_a_id,user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const matchedIds = new Set<string>();
  (matches ?? []).forEach((m) => {
    const other = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
    if (other) matchedIds.add(other);
  });

  const [{ data: profiles }, { data: photos }] = await Promise.all([
    supabase.from('profiles').select('user_id,first_name').in('user_id', womanIds),
    supabase.from('photos').select('user_id,url,position').in('user_id', womanIds).order('position'),
  ]);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
  const photoMap = new Map<string, string | undefined>();
  (photos ?? []).forEach((photo) => {
    if (!photoMap.has(photo.user_id) && photo.position === 1) {
      photoMap.set(photo.user_id, photo.url);
    }
  });

  return likes
    .filter((like) => !blockedIds.includes(like.from_user_id) && !matchedIds.has(like.from_user_id))
    .map((like) => ({
      likeId: like.id,
      womanId: like.from_user_id,
      bumpId: like.bump_id ?? '',
      name: profileMap.get(like.from_user_id)?.first_name ?? 'Someone',
      createdAtLabel: formatRelativeLabel(like.created_at),
      photo: photoMap.get(like.from_user_id),
    }));
};

const WomanBumpCard = ({
  bump,
  onRespond,
  onBlock,
  onReport,
  isProcessing,
}: {
  bump: WomanBumpCard;
  onRespond: (action: 'no' | 'yes') => void;
  onBlock: () => void;
  onReport: () => void;
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
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionIconButton, styles.actionNo]}
          onPress={() => onRespond('no')}
          disabled={isProcessing}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionIconButton, styles.actionYes]}
          onPress={() => onRespond('yes')}
          disabled={isProcessing}
        >
          <Ionicons name="checkmark" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.safetyRow}>
        <TouchableOpacity onPress={onReport}>
          <Text style={styles.safetyText}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBlock}>
          <Text style={styles.safetyText}>Block</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const IncomingLikeCardComponent = ({
  like,
  onRespond,
  onBlock,
  onReport,
  isProcessing,
}: {
  like: IncomingLikeCard;
  onRespond: (action: 'no' | 'match') => void;
  onBlock: () => void;
  onReport: () => void;
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
        Someone you crossed paths with likes you ({like.createdAtLabel}).
      </Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionIconButton, styles.actionNo]}
          onPress={() => onRespond('no')}
          disabled={isProcessing}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionIconButton, styles.actionYes]}
          onPress={() => onRespond('match')}
          disabled={isProcessing}
        >
          <Ionicons name="checkmark" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.safetyRow}>
        <TouchableOpacity onPress={onReport}>
          <Text style={styles.safetyText}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBlock}>
          <Text style={styles.safetyText}>Block</Text>
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
  const { width: screenWidth } = useWindowDimensions();
  const [womanIndex, setWomanIndex] = useState(0);
  const [manIndex, setManIndex] = useState(0);
  const womanTranslateX = useRef(new Animated.Value(0)).current;
  const manTranslateX = useRef(new Animated.Value(0)).current;
  const [animating, setAnimating] = useState(false);

  const blocksQuery = useQuery({
    queryKey: ['blocks', userId],
    queryFn: () => fetchBlockedUserIds(userId ?? ''),
    enabled: !!userId,
  });

  const bumpsQuery = useQuery({
    queryKey: ['bumps', userId],
    queryFn: () => fetchWomanBumps(userId ?? '', blocksQuery.data ?? []),
    enabled: !!userId && isWoman,
  });

  const likesQuery = useQuery({
    queryKey: ['incomingLikes', userId],
    queryFn: () => fetchIncomingLikes(userId ?? '', blocksQuery.data ?? []),
    enabled: !!userId && profile?.gender === 'man',
  });

  const womanCards = bumpsQuery.data ?? [];
  const manCards = likesQuery.data ?? [];

  useEffect(() => {
    setWomanIndex(0);
    womanTranslateX.setValue(0);
  }, [womanCards.length, womanTranslateX]);

  useEffect(() => {
    setManIndex(0);
    manTranslateX.setValue(0);
  }, [manCards.length, manTranslateX]);

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

  const blockMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error('Missing user');
      await blockUser(userId, targetUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', userId] });
      queryClient.invalidateQueries({ queryKey: ['bumps', userId] });
      queryClient.invalidateQueries({ queryKey: ['incomingLikes', userId] });
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const reportMutation = useMutation({
    mutationFn: async ({ targetUserId, reason }: { targetUserId: string; reason: string }) => {
      if (!userId) throw new Error('Missing user');
      await reportUser(userId, targetUserId, reason);
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const handleReport = (targetUserId: string) => {
    const reasons = ['Harassment', 'Fake profile', 'Spam', 'Other'];
    Alert.alert(
      'Report user',
      'Select a reason',
      reasons.map((reason) => ({
        text: reason,
        onPress: () => reportMutation.mutate({ targetUserId, reason }),
      })),
    );
  };

  const animateAndAdvance = (translate: Animated.Value, direction: 'left' | 'right', onDone: () => void) => {
    const toValue = direction === 'left' ? -screenWidth * 1.1 : screenWidth * 1.1;
    setAnimating(true);
    Animated.timing(translate, {
      toValue,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      translate.setValue(0);
      setAnimating(false);
      onDone();
    });
  };

  const renderWomanFeed = () => {
    if (bumpsQuery.isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!womanCards.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No bumps yet</Text>
          <Text style={styles.emptySubtitle}>Visit public spots and check back for new bumps.</Text>
        </View>
      );
    }
    const current = womanCards[womanIndex];
    if (!current) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySubtitle}>Check back later for new bumps.</Text>
        </View>
      );
    }
    return (
      <View style={styles.stack}>
        <Animated.View style={{ transform: [{ translateX: womanTranslateX }] }}>
          <WomanBumpCard
            bump={current}
            isProcessing={womanDecisionMutation.isPending || animating}
            onRespond={(decision) => {
              if (womanDecisionMutation.isPending || animating) return;
              const direction = decision === 'no' ? 'left' : 'right';
              animateAndAdvance(womanTranslateX, direction, () => {
                womanDecisionMutation.mutate(
                  { manId: current.manId, decision, bumpId: current.id },
                  { onSuccess: () => setWomanIndex((i) => i + 1) },
                );
              });
            }}
            onBlock={() => blockMutation.mutate(current.manId)}
            onReport={() => handleReport(current.manId)}
          />
        </Animated.View>
      </View>
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
    if (!manCards.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No likes yet</Text>
          <Text style={styles.emptySubtitle}>We’ll notify you when someone sends a ping.</Text>
        </View>
      );
    }
    const current = manCards[manIndex];
    if (!current) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySubtitle}>Check back later for more.</Text>
        </View>
      );
    }
    return (
      <View style={styles.stack}>
        <Animated.View style={{ transform: [{ translateX: manTranslateX }] }}>
          <IncomingLikeCardComponent
            like={current}
            isProcessing={likeResponseMutation.isPending || animating}
            onRespond={(action) => {
              const direction = action === 'no' ? 'left' : 'right';
              animateAndAdvance(manTranslateX, direction, () => {
                likeResponseMutation.mutate(
                  {
                    likeId: current.likeId,
                    bumpId: current.bumpId,
                    womanId: current.womanId,
                    action,
                  },
                  { onSuccess: () => setManIndex((i) => i + 1) },
                );
              });
            }}
            onBlock={() => blockMutation.mutate(current.womanId)}
            onReport={() => handleReport(current.womanId)}
          />
        </Animated.View>
      </View>
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
    padding: spacing.lg,
  },
  stack: {
    flex: 1,
    justifyContent: 'center',
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  actionIconButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  actionNo: {
    backgroundColor: colors.danger,
  },
  actionYes: {
    backgroundColor: colors.success,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  safetyRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  safetyText: {
    color: colors.mutedText,
    fontSize: typography.caption,
    fontWeight: '600',
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

