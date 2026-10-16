import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton, OtpInput, Screen, Text, TextField, useToast } from '@/components/ui';
import { useErrorText } from '@/lib/errors';
import { SUPABASE_URL, supabase } from '@/lib/supabase';
import { useThemedStyles, type Theme } from '@/theme';

const OTP_LENGTH = 6;
/** Matches supabase/config.toml `[auth.email] max_frequency = "30s"`. */
const RESEND_COOLDOWN_S = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Local Supabase: Mailpit runs next to the API (44321 → 44324). */
const MAILPIT_URL = /:44321$/.test(SUPABASE_URL) ? SUPABASE_URL.replace(/:44321$/, ':44324') : null;

/** Only in-app paths are accepted as `?next=` (no open redirects). */
function safeNext(next: unknown): Href | null {
  if (typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return null;
  if (next.startsWith('/sign-in')) return null;
  return next as Href;
}

function isInvalidOtp(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { code, status } = e as { code?: unknown; status?: unknown };
  return code === 'otp_expired' || code === 'otp_disabled' || status === 403 || status === 401;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -t.spacing.sm },
    header: { gap: t.spacing.sm, marginTop: t.spacing.lg, marginBottom: t.spacing.xl },
    brandDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: t.colors.primary,
      marginBottom: t.spacing.sm,
    },
    form: { gap: t.spacing.lg },
    links: { alignItems: 'center', gap: t.spacing.xs },
    footer: { marginTop: 'auto', paddingTop: t.spacing.xl, gap: t.spacing.sm },
  });

export default function SignInScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['auth', 'common']);
  const errorText = useErrorText();
  const toast = useToast();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const sendCode = async (isResend = false) => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setEmailError(t('invalidEmail'));
      return;
    }
    setBusy(true);
    setEmailError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      if (isResend) setCodeError(errorText(error));
      else setEmailError(errorText(error));
      return;
    }
    setEmail(normalized);
    setCode('');
    setCodeError(null);
    setStep('code');
    setCooldown(RESEND_COOLDOWN_S);
    if (isResend) toast.show(t('codeResent'), 'success');
  };

  const verify = async (token: string) => {
    if (token.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setCodeError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    if (error) {
      setCodeError(isInvalidOtp(error) ? t('invalidCode') : errorText(error));
      return;
    }
    toast.show(t('signedIn'), 'success');
    const target = safeNext(next);
    if (target) router.replace(target);
    else close();
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        <IconButton icon="x" onPress={close} accessibilityLabel={t('common:actions.close')} />
      </View>

      {step === 'email' ? (
        <>
          <View style={styles.header}>
            <View style={styles.brandDot} />
            <Text variant="display" accessibilityRole="header">
              {t('title')}
            </Text>
            <Text color="textMuted">{t('subtitle')}</Text>
          </View>
          <View style={styles.form}>
            <TextField
              label={t('emailLabel')}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError(null);
              }}
              error={emailError}
              placeholder={t('emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              inputMode="email"
              returnKeyType="send"
              autoFocus
              onSubmitEditing={() => void sendCode()}
            />
            <Button
              title={t('sendCode')}
              onPress={() => void sendCode()}
              loading={busy}
              size="lg"
              fullWidth
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.brandDot} />
            <Text variant="display" accessibilityRole="header">
              {t('codeTitle')}
            </Text>
            <Text color="textMuted">{t('codeSentTo', { email })}</Text>
          </View>
          <View style={styles.form}>
            <OtpInput
              length={OTP_LENGTH}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (codeError) setCodeError(null);
              }}
              onComplete={(v) => void verify(v)}
              error={Boolean(codeError)}
              autoFocus
            />
            {codeError ? (
              <Text color="danger" align="center" accessibilityLiveRegion="polite" role="alert">
                {codeError}
              </Text>
            ) : null}
            <Button
              title={t('verify')}
              onPress={() => void verify(code)}
              loading={busy}
              disabled={code.length !== OTP_LENGTH}
              size="lg"
              fullWidth
            />
            <View style={styles.links}>
              <Button
                variant="ghost"
                title={cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
                onPress={() => void sendCode(true)}
                disabled={cooldown > 0 || busy}
              />
              <Button
                variant="ghost"
                title={t('changeEmail')}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setCodeError(null);
                }}
              />
            </View>
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text variant="caption" color="textMuted" align="center">
          {t('privacyNote')}
        </Text>
        {__DEV__ && MAILPIT_URL ? (
          <Text variant="caption" color="textMuted" align="center" selectable>
            {t('devMailpit', { url: MAILPIT_URL })}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
