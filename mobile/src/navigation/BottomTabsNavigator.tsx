import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import BumpsScreen from '../screens/Bumps/BumpsScreen';
import ChatsScreen from '../screens/Chats/ChatsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { colors } from '../theme';

export type TabParamList = {
  Bumps: undefined;
  Chats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const BottomTabsNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.mutedText,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      },
      tabBarIcon: ({ color, size }) => {
        const iconMap: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
          Bumps: 'sparkles',
          Chats: 'chatbubbles',
          Profile: 'person-circle',
        };
        const iconName = iconMap[route.name as keyof TabParamList];
        return <Ionicons name={iconName} color={color} size={size} />;
      },
    })}
  >
    <Tab.Screen name="Bumps" component={BumpsScreen} options={{ title: 'Bumps' }} />
    <Tab.Screen name="Chats" component={ChatsScreen} options={{ title: 'Chats' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

export default BottomTabsNavigator;

