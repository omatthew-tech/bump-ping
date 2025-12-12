import { FlatList, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '../../theme';
import { useAuthContext } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabaseClient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type MatchRow = {
  id: string;
  name: string;
  place: string;
  createdAtLabel: string;
};

const fetchMatches = async (userId: string): Promise<MatchRow[]> => {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id,user_a_id,user_b_id,bump_id,created_at')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!matches?.length) return [];

  const counterpartIds = matches.map((match) =>
    match.user_a_id === userId ? match.user_b_id : match.user_a_id,
  );
  const bumpIds = matches.map((match) => match.bump_id).filter(Boolean) as string[];

  const [{ data: profiles }, { data: bumps }] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id,first_name')
      .in('user_id', counterpartIds),
    bumpIds.length
      ? supabase.from('bumps').select('id,place:places(name)').in('id', bumpIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
  const bumpMap = new Map((bumps ?? []).map((b) => [b.id, b]));

  return matches.map((match) => ({
    id: match.id,
    name: profileMap.get(match.user_a_id === userId ? match.user_b_id : match.user_a_id)?.first_name ?? 'Match',
    place:
      (bumpMap.get(match.bump_id ?? '')?.place as { name?: string } | null)?.name ??
      'your bump spot',
    createdAtLabel: new Date(match.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));
};

const ChatRow = ({ name, place, createdAtLabel, onPress }: MatchRow & { onPress: () => void }) => (
  <TouchableOpacity style={styles.row} onPress={onPress}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name[0]}</Text>
    </View>
    <View style={styles.meta}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.preview}>Met near {place}</Text>
    </View>
    <Text style={styles.timestamp}>{createdAtLabel}</Text>
  </TouchableOpacity>
);

const ChatsScreen = () => {
  const { session } = useAuthContext();
  const userId = session?.user.id;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const matchesQuery = useQuery({
    queryKey: ['matches', userId],
    queryFn: () => fetchMatches(userId ?? ''),
    enabled: !!userId,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Text style={styles.title}>Matches & chats</Text>
      {matchesQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : matchesQuery.data?.length ? (
        <FlatList
          data={matchesQuery.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatRow
              {...item}
              onPress={() => navigation.navigate('ChatThread', { matchId: item.id, name: item.name })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>When someone matches with you, chats will appear here.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 20,
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
    gap: spacing.xs,
  },
  name: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  preview: {
    fontSize: typography.caption,
    color: colors.mutedText,
  },
  timestamp: {
    fontSize: typography.caption,
    color: colors.mutedText,
  },
  separator: {
    height: spacing.sm,
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

export default ChatsScreen;

