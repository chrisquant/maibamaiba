import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet } from "react-native";
import { HomeScreen } from "../screens/tabs/HomeScreen";
import { StatsScreen } from "../screens/tabs/StatsScreen";
import { WishScreen } from "../screens/tabs/WishScreen";
import { ProfileScreen } from "../screens/tabs/ProfileScreen";
import { colors } from "../theme/colors";
import { tokens } from "../theme/tokens";
import { RootStackParamList, RootTabParamList } from "./types";
import { AssetFormScreen } from "../screens/AssetFormScreen";
import { AssetDetailScreen } from "../screens/AssetDetailScreen";
import { CategoryManageScreen } from "../screens/CategoryManageScreen";
import { CategoryDetailScreen } from "../screens/CategoryDetailScreen";

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type IoniconName = keyof typeof Ionicons.glyphMap;

const tabIcon =
  (outline: IoniconName, filled: IoniconName): BottomTabNavigationOptions["tabBarIcon"] =>
  ({ color, size, focused }) =>
    (
      <Ionicons
        name={focused ? filled : outline}
        size={focused ? size + 1 : size}
        color={color}
      />
    );

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  },
};

const TabsNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: "rgba(31, 58, 95, 0.12)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62,
          paddingTop: 4,
          elevation: 6,
          shadowColor: tokens.colors.ocean700,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "首页", tabBarIcon: tabIcon("home-outline", "home") }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: "统计",
          tabBarIcon: tabIcon("stats-chart-outline", "stats-chart"),
        }}
      />
      <Tab.Screen
        name="Wish"
        component={WishScreen}
        options={{
          title: "心愿",
          tabBarIcon: tabIcon("gift-outline", "gift"),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "我的",
          tabBarIcon: tabIcon("person-outline", "person"),
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator>
        <Stack.Screen
          name="Tabs"
          component={TabsNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AssetForm"
          component={AssetFormScreen}
          options={{
            title: "资产编辑",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="AssetDetail"
          component={AssetDetailScreen}
          options={{
            title: "资产详情",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="CategoryManage"
          component={CategoryManageScreen}
          options={{
            title: "分类管理",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="CategoryDetail"
          component={CategoryDetailScreen}
          options={{
            title: "分类详情",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
