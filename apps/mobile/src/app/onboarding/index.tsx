import { TEXT_LIMITS } from '@bojo/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { MIN_NAME_LENGTH, StepScaffold, useResumeOnboarding } from '@/features/onboarding';
import { AvatarEditor, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    body: { gap: t.spacing.xl },
  });

/** Step 1 — name + avatar. Also fast-forwards to the first unfinished step (resumable flow). */
export default function OnboardingNameScreen() {
  const { profile } = useAuth();
  if (!profile) {
    return <StepScaffold step={1} title="" primaryLabel="" onPrimary={() => undefined} loading />;
  }
  return <NameStep initialName={profile.display_name} />;
}

function NameStep({ initialName }: { initialName: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['onboarding', 'common']);
  const { signOut } = useAuth();
  const errorText = useErrorText();
  const update = useUpdateProfile();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const valid = trimmed.length >= MIN_NAME_LENGTH;

  useResumeOnboarding();

  const onNext = () => {
    if (!valid) {
      setError(t('onboarding:name.tooShort', { count: MIN_NAME_LENGTH }));
      return;
    }
    setError(null);
    if (trimmed === initialName.trim()) {
      router.push('/onboarding/sports');
      return;
    }
    update.mutate(
      { display_name: trimmed },
      {
        onSuccess: () => router.push('/onboarding/sports'),
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  return (
    <StepScaffold
      step={1}
      title={t('onboarding:name.title')}
      subtitle={t('onboarding:name.subtitle')}
      primaryLabel={t('common:actions.next')}
      onPrimary={onNext}
      primaryDisabled={!valid}
      primaryLoading={update.isPending}
      error={error}
      testID="onboarding-name"
      footerExtra={
        <Button
          title={t('onboarding:name.signOut')}
          variant="ghost"
          onPress={() => void signOut()}
          fullWidth
        />
      }
    >
      <View style={styles.body}>
        <AvatarEditor name={trimmed} />
        <TextField
          label={t('onboarding:name.label')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          placeholder={t('onboarding:name.placeholder')}
          maxLength={TEXT_LIMITS.displayName}
          autoComplete="given-name"
          textContentType="givenName"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={onNext}
          hint={t('onboarding:name.hint', { count: name.length, max: TEXT_LIMITS.displayName })}
          testID="onboarding-name-input"
        />
      </View>
    </StepScaffold>
  );
}
