import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { pickAvatarImage, useSetAvatar } from '../api';

const SIZE = 104;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
    avatarWrap: { width: SIZE, height: SIZE },
    badge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.colors.primary,
      borderWidth: 3,
      borderColor: t.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    busy: {
      ...StyleSheet.absoluteFill,
      borderRadius: SIZE / 2,
      backgroundColor: t.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    side: { flex: 1, gap: t.spacing.xs, alignItems: 'flex-start' },
  });

/** Own avatar with "add / change / remove photo". Uploads immediately (re-encoded, EXIF stripped). */
export function AvatarEditor({ name }: { name: string }) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const { profile } = useAuth();
  const setAvatar = useSetAvatar();
  const [error, setError] = useState<string | null>(null);
  const path = profile?.avatar_path ?? null;

  const pick = async () => {
    setError(null);
    try {
      const uri = await pickAvatarImage();
      if (!uri) return;
      setAvatar.mutate(uri, { onError: (e) => setError(errorText(e)) });
    } catch (e) {
      setError(errorText(e));
    }
  };
  const remove = () => {
    setError(null);
    setAvatar.mutate(null, { onError: (e) => setError(errorText(e)) });
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={pick}
        disabled={setAvatar.isPending}
        accessibilityRole="button"
        accessibilityLabel={path ? t('avatar.change') : t('avatar.add')}
        style={styles.avatarWrap}
        testID="avatar-pick"
      >
        <Avatar path={path} name={name || '?'} size={SIZE} />
        <View style={styles.badge} aria-hidden>
          <Icon name="camera" size={16} color={theme.colors.onPrimary} />
        </View>
        {setAvatar.isPending ? (
          <View style={styles.busy}>
            <ActivityIndicator color={theme.colors.textInverse} />
          </View>
        ) : null}
      </Pressable>
      <View style={styles.side}>
        <Text variant="label" color="textMuted">
          {t('avatar.hint')}
        </Text>
        <Button
          title={path ? t('avatar.change') : t('avatar.add')}
          variant="secondary"
          onPress={pick}
          disabled={setAvatar.isPending}
        />
        {path ? (
          <Button
            title={t('avatar.remove')}
            variant="ghost"
            onPress={remove}
            disabled={setAvatar.isPending}
          />
        ) : null}
        {error ? (
          <Text variant="caption" color="danger" role="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
