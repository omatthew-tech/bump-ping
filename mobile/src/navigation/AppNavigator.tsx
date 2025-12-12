import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabsNavigator from './BottomTabsNavigator';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import { RootStackParamList } from './types';
import EmailAuthScreen from '../screens/Auth/EmailAuthScreen';
import { useAuthContext } from '../providers/AuthProvider';
import { colors } from '../theme';
import VisitTrackingManager from '../location/VisitTrackingManager';
import { useUserStatus } from '../hooks/useUserStatus';
import ChatThreadScreen from '../screens/Chats/ChatThreadScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { session, profile, isLoading, refreshProfile } = useAuthContext();
  const { isPaused } = useUserStatus(session?.user.id);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="Auth" component={EmailAuthScreen} />
      ) : !profile ? (
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onComplete={refreshProfile}
            />
          )}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="MainTabs">
          {() => (
            <VisitTrackingManager enabled={!isPaused}>
              <BottomTabsNavigator />
            </VisitTrackingManager>
          )}
        </Stack.Screen>
      )}
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

export default AppNavigator;

