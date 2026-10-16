import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, IconButton, Text, webOnly } from '@/components/ui';
import { Icon } from '@/icons';
import { useLanguage } from '@/i18n';
import { formatTime } from '@/lib/datetime';
import { useThemedStyles, type Theme } from '@/theme';

import type { ChatMessage } from '../api';

export type SendState = 'sent' | 'sending' | 'failed';

export interface MessageBubbleProps {
  message: ChatMessage;
  own: boolean;
  senderName: string;
  senderAvatar: string | null;
  /** Group chats: name above the first bubble of a run. */
  showName: boolean;
  /** Group chats: avatar next to the last bubble of a run (others keep the gutter). */
  showAvatar: boolean;
  /** Reserve the avatar gutter (event chats). */
  group: boolean;
  sendState?: SendState;
  onLongPress?: () => void;
  onRetry?: () => void;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { alignItems: 'flex-start', marginTop: 2, gap: 2 },
    wrapOwn: { alignItems: 'flex-end' },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm, maxWidth: '82%' },
    rowOwn: { justifyContent: 'flex-end' },
    gutter: { width: 28 },
    indent: { marginLeft: 36 },
    bubble: {
      flexShrink: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 18,
    },
    bubbleOwn: { backgroundColor: t.colors.text, borderBottomRightRadius: 6 },
    bubbleOther: {
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      borderBottomLeftRadius: 6,
    },
    failed: { opacity: 0.6 },
    pressed: { opacity: 0.85 },
    name: { marginLeft: 4, marginTop: t.spacing.sm },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    retry: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
    more: { marginLeft: -t.spacing.xs },
  });

const IS_WEB = Platform.OS === 'web';

export function MessageBubble({
  message,
  own,
  senderName,
  senderAvatar,
  showName,
  showAvatar,
  group,
  sendState = 'sent',
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('chat');
  const language = useLanguage();
  const time = formatTime(message.created_at, language);
  const spoken = own
    ? t('message.a11yOwn', { body: message.body, time })
    : t('message.a11y', { name: senderName, body: message.body, time });

  const indent = !own && group ? styles.indent : null;
  return (
    <View style={[styles.wrap, own ? styles.wrapOwn : null]}>
      {!own && group && showName ? (
        <Text variant="caption" color="textMuted" style={[styles.name, indent]} numberOfLines={1}>
          {senderName}
        </Text>
      ) : null}
      <View style={[styles.row, own ? styles.rowOwn : null]}>
        {!own && group ? (
          showAvatar ? (
            <Avatar name={senderName} path={senderAvatar} size={28} />
          ) : (
            <View style={styles.gutter} />
          )
        ) : null}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={350}
          disabled={!onLongPress}
          // Web: an article named by the spoken summary (no aria-label on a role-less div); the
          // bubble itself is a pointer target only — keyboard users get the "⋯" button.
          {...(IS_WEB
            ? { role: 'article' as const, 'aria-label': spoken, tabIndex: -1 as const }
            : {
                accessibilityRole: 'text' as const,
                accessibilityLabel: spoken,
                accessibilityHint: onLongPress ? t('message.actionsHint') : undefined,
                accessibilityActions: onLongPress
                  ? [{ name: 'longpress', label: t('message.actions') }]
                  : undefined,
                onAccessibilityAction: () => onLongPress?.(),
              })}
          {...webOnly({
            // Right click / long-press context menu on web opens the same actions.
            onContextMenu: (e: { preventDefault: () => void }) => {
              if (!onLongPress) return;
              e.preventDefault();
              onLongPress();
            },
          })}
          style={({ pressed }) => [
            styles.bubble,
            own ? styles.bubbleOwn : styles.bubbleOther,
            sendState === 'failed' ? styles.failed : null,
            pressed && onLongPress ? styles.pressed : null,
          ]}
        >
          <Text color={own ? 'textInverse' : 'text'} selectable>
            {message.body}
          </Text>
        </Pressable>
        {IS_WEB && !own && onLongPress ? (
          <IconButton
            icon="more-horizontal"
            onPress={onLongPress}
            accessibilityLabel={t('message.moreA11y', { name: senderName })}
            color="textMuted"
            iconSize={18}
            style={styles.more}
          />
        ) : null}
      </View>
      {sendState === 'failed' ? (
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('message.retryA11y')}
          style={[styles.retry, indent]}
        >
          <Icon name="alert-circle" size={14} color="danger" />
          <Text variant="caption" color="danger">
            {t('message.failed')}
          </Text>
        </Pressable>
      ) : showAvatar || own ? (
        <View style={[styles.meta, indent]} aria-hidden>
          <Text variant="caption" color="textMuted">
            {time}
          </Text>
          {own ? (
            <Icon name={sendState === 'sending' ? 'clock' : 'check'} size={12} color="textMuted" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
