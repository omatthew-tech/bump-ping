import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabaseClient';
import { useAuthContext } from '../../providers/AuthProvider';

type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

const fetchMessages = async (matchId: string): Promise<MessageRow[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('id,sender_id,body,created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as MessageRow[];
};

const ChatThreadScreen = ({ route }: Props) => {
  const { matchId, name } = route.params;
  const { session } = useAuthContext();
  const userId = session?.user.id;
  const [pendingText, setPendingText] = useState('');
  const [realtimeBuffer, setRealtimeBuffer] = useState<MessageRow[]>([]);

  const messagesQuery = useQuery({
    queryKey: ['messages', matchId],
    queryFn: () => fetchMessages(matchId),
    enabled: !!matchId,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setRealtimeBuffer((prev) => [...prev, newMsg]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !pendingText.trim()) throw new Error('Message empty');
      const { error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: userId,
        body: pendingText.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPendingText('');
    },
  });

  const messages = [...(messagesQuery.data ?? []), ...realtimeBuffer].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.subtitle}>Met near your bump spot</Text>
      </View>
      {messagesQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isMine = item.sender_id === userId;
            return (
              <View
                style={[
                  styles.bubble,
                  isMine ? styles.bubbleMine : styles.bubbleTheirs,
                  isMine ? styles.bubbleRight : styles.bubbleLeft,
                ]}
              >
                <Text style={isMine ? styles.textMine : styles.textTheirs}>{item.body}</Text>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          <TextInput
            placeholder="Say hello…"
            style={styles.input}
            value={pendingText}
            onChangeText={setPendingText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!pendingText.trim() || sendMessageMutation.isPending) && styles.sendDisabled]}
            disabled={!pendingText.trim() || sendMessageMutation.isPending}
            onPress={() => sendMessageMutation.mutate()}
          >
            <Text style={styles.sendLabel}>{sendMessageMutation.isPending ? 'Sending…' : 'Send'}</Text>
          </TouchableOpacity>
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
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  bubble: {
    maxWidth: '78%',
    padding: spacing.md,
    borderRadius: 18,
    marginBottom: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  textMine: {
    color: colors.surface,
    fontWeight: '600',
  },
  textTheirs: {
    color: colors.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  sendButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: colors.surface,
    fontWeight: '700',
  },
});

export default ChatThreadScreen;

