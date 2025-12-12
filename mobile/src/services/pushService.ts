import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabaseClient';

type RegisterResult =
  | { token: string }
  | { error: string };

export const registerPushToken = async (userId: string): Promise<RegisterResult> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { error: 'Notification permission not granted' };
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) {
      return { error: 'Unable to get push token' };
    }

    const { error } = await supabase.from('push_tokens').upsert({
      user_id: userId,
      token,
      platform: Platform.OS,
    });
    if (error) {
      return { error: error.message };
    }
    return { token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown push error' };
  }
};

export const configureNotificationHandling = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
};

