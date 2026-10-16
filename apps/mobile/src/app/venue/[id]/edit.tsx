// Suggest a correction (b2, auth): form prefilled from venue_detail; only changed whitelisted keys
// (name, surface, is_lit, is_free, is_indoor, opening_hours, sport_ids) go to suggest_venue_edit('update').
// Separate "the venue is closed / doesn't exist" → suggest_venue_edit('close'). Pending state when the
// user already has an edit under review.
import {
  isSportId,
  TEXT_LIMITS,
  VENUE_SURFACES,
  type VenueDetailRow,
  type VenueEditProposal,
  type VenueSurface,
} from '@bojo/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import {
  ConfirmSheet,
  hasErrors,
  OPENING_HOURS_MAX,
  SignInGate,
  useSuggestVenueEdit,
  useVenueDetail,
  VenueFormFields,
  venueTitle,
  type VenueFormErrors,
  type VenueFormValues,
} from '@/features/venues';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';
import { useThemedStyles, type Theme } from '@/theme';

const COMMENT_MAX = 500;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: t.colors.background },
    scroll: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.xl,
    },
    head: { gap: t.spacing.xs },
    closeCard: { gap: t.spacing.md },
    skeleton: { padding: t.layout.screenGutter, gap: t.spacing.lg },
  });

function isSurface(v: string | null): v is VenueSurface {
  return v !== null && (VENUE_SURFACES as readonly string[]).includes(v);
}

function fromVenue(v: VenueDetailRow): VenueFormValues {
  return {
    name: v.name ?? '',
    kind: v.kind,
    sportIds: v.sport_ids.filter(isSportId),
    surface: isSurface(v.surface) ? v.surface : null,
    isLit: v.is_lit,
    isFree: v.is_free,
    isIndoor: v.is_indoor,
    openingHours: v.opening_hours ?? '',
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Only keys the user actually changed (unknown never overwrites a known value). */
function buildProposal(v: VenueDetailRow, f: VenueFormValues): VenueEditProposal {
  const p: VenueEditProposal = {};
  const name = f.name.trim();
  if (name && name !== (v.name ?? '')) p.name = name;
  if (f.surface !== null && f.surface !== v.surface) p.surface = f.surface;
  if (f.isLit !== null && f.isLit !== v.is_lit) p.is_lit = f.isLit;
  if (f.isFree !== null && f.isFree !== v.is_free) p.is_free = f.isFree;
  if (f.isIndoor !== null && f.isIndoor !== v.is_indoor) p.is_indoor = f.isIndoor;
  const hours = f.openingHours.trim();
  if (hours !== (v.opening_hours ?? '').trim()) p.opening_hours = hours;
  if (f.sportIds.length > 0 && !sameSet(f.sportIds, v.sport_ids)) p.sport_ids = f.sportIds;
  return p;
}

export default function VenueEditScreen() {
  const { t } = useTranslation(['venues', 'common']);
  const styles = useThemedStyles(createStyles);
  const { session, isLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const venueId = typeof id === 'string' ? id : '';
  const detail = useVenueDetail(session ? venueId : undefined);
  const header = <Stack.Screen options={{ title: t('common:screens.venueEdit') }} />;

  if (isLoading) return header;
  if (!session) {
    return (
      <>
        {header}
        <SignInGate title={t('edit.signInTitle')} message={t('edit.signInMessage')} />
      </>
    );
  }
  if (detail.isPending) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.skeleton}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="100%" height={48} radius={14} />
          <Skeleton width="100%" height={96} radius={14} />
        </View>
      </View>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={styles.flex}>
        {header}
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </View>
    );
  }
  return (
    <>
      {header}
      <EditForm venue={detail.data} />
    </>
  );
}

function EditForm({ venue }: { venue: VenueDetailRow }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['venues', 'common']);
  const toast = useToast();
  const errorText = useErrorText();
  const suggest = useSuggestVenueEdit(venue.id);

  const [showForm, setShowForm] = useState(!venue.has_pending_edit_by_me);
  const [values, setValues] = useState<VenueFormValues>(() => fromVenue(venue));
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<VenueFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const title = venueTitle(venue.name, venue.kind, venue.sport_ids, t);

  if (!showForm) {
    return (
      <View style={styles.flex}>
        <EmptyState
          icon="clock"
          title={t('edit.pendingTitle')}
          message={t('edit.pendingMessage')}
          action={
            <View style={styles.closeCard}>
              <Button title={t('common:actions.back')} onPress={() => router.back()} />
              <Button
                title={t('edit.suggestAnother')}
                onPress={() => setShowForm(true)}
                variant="ghost"
              />
            </View>
          }
        />
      </View>
    );
  }

  const validate = (): VenueFormErrors => {
    const name = values.name.trim();
    return {
      // Unnamed OSM venues may stay unnamed; an existing name can't be blanked.
      name:
        (venue.name && name.length === 0) || name.length > TEXT_LIMITS.venueName
          ? t('form.nameError')
          : null,
      sports: values.sportIds.length === 0 ? t('form.sportsError') : null,
      hours: values.openingHours.trim().length > OPENING_HOURS_MAX ? t('form.hoursError') : null,
    };
  };

  const done = (message: string) => {
    toast.show(message, 'success');
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/venue/[id]', params: { id: venue.id } });
  };

  const submit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    const commentTooLong = comment.trim().length > COMMENT_MAX;
    if (hasErrors(nextErrors) || commentTooLong) return;
    const proposed = buildProposal(venue, values);
    if (Object.keys(proposed).length === 0) {
      setFormError(t('edit.noChanges'));
      return;
    }
    setFormError(null);
    try {
      await suggest.mutateAsync({ kind: 'update', proposed, comment });
      done(t('edit.sent'));
    } catch (e) {
      toast.show(errorText(e), 'danger');
    }
  };

  const reportClosed = async () => {
    try {
      await suggest.mutateAsync({ kind: 'close', comment });
      setConfirmClose(false);
      done(t('edit.closeSent'));
    } catch (e) {
      setConfirmClose(false);
      toast.show(errorText(e), 'danger');
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // iOS: the keyboard never covers the focused field or the submit button.
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.head}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <Text color="textMuted">{t('edit.intro')}</Text>
        </View>

        <VenueFormFields
          values={values}
          onChange={(patch) => {
            setFormError(null);
            setValues((v) => ({ ...v, ...patch }));
          }}
          errors={errors}
          showKind={false}
        />

        <TextField
          label={t('form.comment')}
          value={comment}
          onChangeText={setComment}
          hint={t('form.commentHint')}
          error={comment.trim().length > COMMENT_MAX ? t('form.commentError') : null}
          multiline
          maxLength={COMMENT_MAX + 50}
        />

        {formError ? (
          <Text color="danger" role="alert" accessibilityLiveRegion="polite">
            {formError}
          </Text>
        ) : null}

        <Button
          title={t('edit.submit')}
          onPress={() => void submit()}
          loading={suggest.isPending && !confirmClose}
          size="lg"
          fullWidth
        />

        <Card style={styles.closeCard}>
          <Text variant="heading" accessibilityRole="header">
            {t('edit.closeSection')}
          </Text>
          <Button
            title={t('edit.closeAction')}
            onPress={() => setConfirmClose(true)}
            variant="secondary"
            icon="slash"
          />
        </Card>
      </ScrollView>

      <ConfirmSheet
        visible={confirmClose}
        title={t('edit.closeConfirmTitle')}
        message={t('edit.closeConfirmMessage')}
        confirmLabel={t('edit.closeConfirm')}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => void reportClosed()}
        loading={suggest.isPending}
        destructive
      />
    </View>
  );
}
