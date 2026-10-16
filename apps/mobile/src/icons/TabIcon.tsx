import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Tab-bar icon set (Feather). */
export const TAB_ICONS = {
  map: 'map',
  events: 'calendar',
  people: 'users',
  chats: 'message-circle',
  profile: 'user',
} as const satisfies Record<string, IconName>;

export type TabIconName = keyof typeof TAB_ICONS;

export interface TabIconProps {
  name: TabIconName;
  focused: boolean;
  /** Tint provided by the tab bar. */
  color: string;
  size?: number;
}

/** Active tab: lime pill behind the icon (accent = active state, DESIGN.md); inactive: muted glyph. */
export function TabIcon({ name, focused, color, size = 22 }: TabIconProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 52,
        height: 28,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? theme.colors.primary : 'transparent',
      }}
    >
      <Icon name={TAB_ICONS[name]} size={size} color={focused ? theme.colors.onPrimary : color} />
    </View>
  );
}
