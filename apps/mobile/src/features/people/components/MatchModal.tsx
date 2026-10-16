import { isSportId } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Text } from '@/components/ui';
import { SportIcon } from '@/icons';
import { useReduceMotion, useThemedStyles, type Theme } from '@/theme';

export interface MatchInfo {
  matchId: string;
  conversationId: string | null;
  otherName: string;
  otherAvatarPath: string | null;
  sportId: string | null;
}

export interface MatchModalProps {
  match: MatchInfo | null;
  myName: string;
  myAvatarPath: string | null;
  onWrite: (match: MatchInfo) => void;
  onPropose: (match: MatchInfo) => void;
  onClose: () => void;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.layout.screenGutter },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: t.colors.overlay },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.xl,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderColor: t.colors.border,
      paddingHorizontal: t.spacing.xl,
      paddingTop: t.spacing.xxl,
      paddingBottom: t.spacing.xl,
      alignItems: 'center',
      gap: t.spacing.md,
    },
    pair: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.sm },
    second: { marginLeft: -18 },
    sport: {
      position: 'absolute',
      alignSelf: 'center',
      left: '50%',
      marginLeft: -22,
      bottom: -10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.primary,
      borderWidth: 3,
      borderColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: { alignSelf: 'stretch', gap: t.spacing.sm, marginTop: t.spacing.md },
  });

/** "Вы оба хотите поиграть" — friendly sports framing, no dating vibe. */
export function MatchModal({ match, myName, myAvatarPath, onWrite, onPropose, onClose }: MatchModalProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['people', 'vocab']);
  const reduceMotion = useReduceMotion();
  const sport = match?.sportId && isSportId(match.sportId) ? match.sportId : null;
  const sportName = sport ? t(`vocab:sports.${sport}`).toLocaleLowerCase() : null;

  return (
    <Modal
      visible={match !== null}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('people:match.later')}
        />
        {match ? (
          <View style={styles.card} accessibilityViewIsModal role="dialog" aria-modal aria-label={t('people:match.title')}>
            <View style={styles.pair} aria-hidden>
              <Avatar path={myAvatarPath} name={myName || '?'} size={88} ring />
              <Avatar path={match.otherAvatarPath} name={match.otherName} size={88} ring style={styles.second} />
              {sport ? (
                <View style={styles.sport}>
                  <SportIcon sportId={sport} size={22} color="onPrimary" />
                </View>
              ) : null}
            </View>
            <Text variant="title" align="center" accessibilityRole="header">
              {t('people:match.title')}
            </Text>
            <Text color="textMuted" align="center">
              {sportName
                ? t('people:match.textSport', { name: match.otherName, sport: sportName })
                : t('people:match.text', { name: match.otherName })}
            </Text>
            <View style={styles.actions}>
              <Button
                title={t('people:match.write')}
                icon="message-circle"
                size="lg"
                fullWidth
                onPress={() => onWrite(match)}
                disabled={!match.conversationId}
                testID="match-write"
              />
              <Button
                title={t('people:match.propose')}
                icon="calendar"
                variant="secondary"
                size="lg"
                fullWidth
                onPress={() => onPropose(match)}
                testID="match-propose"
              />
              <Button title={t('people:match.later')} variant="ghost" fullWidth onPress={onClose} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
