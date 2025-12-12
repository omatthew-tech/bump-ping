import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserStatus, setPauseStatus, UserStatus } from '../services/userStatusService';

export const useUserStatus = (userId?: string) => {
  const queryClient = useQueryClient();

  const statusQuery = useQuery<UserStatus | null>({
    queryKey: ['userStatus', userId],
    queryFn: () => fetchUserStatus(userId ?? ''),
    enabled: !!userId,
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => setPauseStatus(userId ?? '', paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userStatus', userId] }),
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isPaused: statusQuery.data?.is_paused ?? false,
    setPaused: (value: boolean) => pauseMutation.mutate(value),
    isSettingPaused: pauseMutation.isPending,
  };
};

