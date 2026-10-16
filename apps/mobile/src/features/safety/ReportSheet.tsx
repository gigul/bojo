// Public API (ARCHITECTURE §2.4) — the signature must not change.
import type { ReportReason, ReportTarget } from '@bojo/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, TextField, useToast } from '@/components/ui';
import { Icon } from '@/icons';
import { useErrorText } from '@/lib/errors';
import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { useSubmitReport } from './api';

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
}

/** Report details limit (reports.details ≤ 1000, ARCHITECTURE §3.6). */
const DETAILS_MAX = 1000;

/** Reasons that make sense for each target (all are valid `report_reason` values). */
const REASONS_BY_TARGET: Record<ReportTarget, readonly ReportReason[]> = {
  user: ['spam', 'abuse', 'fake', 'no_show', 'inappropriate', 'other'],
  event: ['spam', 'fake', 'wrong_info', 'abuse', 'inappropriate', 'other'],
  venue: ['wrong_info', 'fake', 'inappropriate', 'spam', 'other'],
  venue_photo: ['inappropriate', 'wrong_info', 'spam', 'other'],
  message: ['spam', 'abuse', 'inappropriate', 'other'],
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { gap: t.spacing.lg, paddingBottom: t.spacing.sm },
    list: { gap: t.spacing.xs },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 48,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.md,
    },
    optionSelected: { backgroundColor: t.colors.surfaceAlt },
    optionPressed: { backgroundColor: t.colors.surfaceAlt },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: t.colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
    optionText: { flex: 1 },
    counter: { alignSelf: 'flex-end', marginTop: -t.spacing.sm },
    note: { flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-start' },
    noteText: { flex: 1 },
  });

export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
}: ReportSheetProps): JSX.Element {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation('safety');
  const { show } = useToast();
  const errorText = useErrorText();
  const submit = useSubmitReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);

  // Fresh form every time the sheet opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setReason(null);
      setDetails('');
      setError(null);
    }
  }

  const reasons = REASONS_BY_TARGET[targetType];

  const onSubmit = () => {
    if (!reason || submit.isPending) return;
    setError(null);
    submit.mutate(
      { targetType, targetId, reason, details },
      {
        onSuccess: () => {
          show(t('report.success'), 'success');
          onClose();
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t(`report.title.${targetType}`)}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.list}
          accessibilityRole="radiogroup"
          aria-label={t('report.reasonLabel')}
        >
          <Text variant="label" color="textMuted">
            {t('report.reasonLabel')}
          </Text>
          {reasons.map((r) => {
            const selected = reason === r;
            return (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                accessibilityLabel={t(`report.reasons.${r}`)}
                style={({ pressed }) => [
                  styles.option,
                  selected ? styles.optionSelected : null,
                  pressed && !selected ? styles.optionPressed : null,
                ]}
                testID={`report-reason-${r}`}
              >
                <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                  {selected ? <Icon name="check" size={14} color={theme.colors.onPrimary} /> : null}
                </View>
                <Text
                  variant={selected ? 'bodyStrong' : 'body'}
                  style={styles.optionText}
                  numberOfLines={2}
                >
                  {t(`report.reasons.${r}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label={t('report.detailsLabel')}
          value={details}
          onChangeText={setDetails}
          placeholder={t('report.detailsPlaceholder')}
          hint={t('report.detailsHint')}
          multiline
          maxLength={DETAILS_MAX}
          testID="report-details"
        />
        <Text variant="caption" color="textMuted" style={styles.counter} aria-hidden>
          {t('report.counter', { count: details.length, max: DETAILS_MAX })}
        </Text>

        <View style={styles.note}>
          <Icon name="shield" size={16} color="textMuted" />
          <Text variant="caption" color="textMuted" style={styles.noteText}>
            {t('report.privacyNote')}
          </Text>
        </View>

        {error ? (
          <Text variant="label" color="danger" role="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Button
          title={t('report.submit')}
          onPress={onSubmit}
          disabled={!reason}
          loading={submit.isPending}
          fullWidth
          accessibilityHint={reason ? undefined : t('report.chooseReason')}
          testID="report-submit"
        />
      </ScrollView>
    </Sheet>
  );
}
