import { Tabs, type BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useUnreadTotal } from '@/features/chat';
import { TabIcon, type TabIconName } from '@/icons';
import { fontStyle, useTheme, type Theme } from '@/theme';

/** Visible bar height above the bottom safe-area inset (icon slot 28 + label 16 + item padding). */
const TAB_BAR_HEIGHT = 64;

/** Tab tints are always our own string colours; a PlatformColor never reaches here. */
function tint(color: ColorValue, theme: Theme): string {
  return typeof color === 'string' ? color : theme.colors.textMuted;
}

function TabLabel({ text, focused, color }: { text: string; focused: boolean; color: ColorValue }) {
  const theme = useTheme();
  return (
    <Text
      variant="caption"
      color={tint(color, theme)}
      maxFontSizeMultiplier={1.3}
      numberOfLines={1}
      style={[styles.label, focused ? fontStyle('bold', theme.fontsLoaded) : null]}
    >
      {text}
    </Text>
  );
}

function tabOptions(
  theme: Theme,
  name: TabIconName,
  title: string,
  accessibilityLabel: string = title,
): BottomTabNavigationOptions {
  return {
    title,
    tabBarAccessibilityLabel: accessibilityLabel,
    tabBarIcon: ({ focused, color }) => (
      <TabIcon name={name} focused={focused} color={tint(color, theme)} />
    ),
    tabBarLabel: ({ focused, color }) => <TabLabel text={title} focused={focused} color={color} />,
  };
}

/** A13: JS Tabs (identical on iOS/Android/web), order Map / Events / People / Chats / Profile. */
export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const unread = useUnreadTotal();
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  const chatsTitle = t('tabs.chats');
  const chatsA11y =
    unread > 0 ? `${chatsTitle}, ${t('tabs.unread', { count: unread })}` : chatsTitle;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Labels always sit under the icon: beside-icon labels (tablet / wide web) collide with the
        // fixed-width active pill.
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarItemStyle: styles.item,
        tabBarBadgeStyle: {
          backgroundColor: colors.danger,
          color: colors.textInverse,
          ...fontStyle('bold', theme.fontsLoaded),
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={tabOptions(theme, 'map', t('tabs.map'))} />
      <Tabs.Screen name="events" options={tabOptions(theme, 'events', t('tabs.events'))} />
      <Tabs.Screen name="people" options={tabOptions(theme, 'people', t('tabs.people'))} />
      <Tabs.Screen
        name="chats"
        options={{
          ...tabOptions(theme, 'chats', chatsTitle, chatsA11y),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={tabOptions(theme, 'profile', t('tabs.profile'))} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  item: { paddingTop: 4, paddingBottom: 2 },
  label: { marginTop: 2, fontSize: 11, lineHeight: 14, flexShrink: 0 },
});
