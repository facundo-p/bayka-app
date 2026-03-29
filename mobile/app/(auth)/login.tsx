import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Switch, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../src/hooks/useAuth';
import * as SecureStore from 'expo-secure-store';
import { colors, fontSize, spacing, borderRadius, fonts } from '../../src/theme';

const SAVED_ACCOUNTS_KEY = 'saved_accounts';

type SavedAccount = {
  email: string;
  password: string;
};

async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await SecureStore.getItemAsync(SAVED_ACCOUNTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveAccount(email: string, password: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const existing = accounts.findIndex(a => a.email === email);
  if (existing >= 0) {
    accounts[existing].password = password;
  } else {
    accounts.push({ email, password });
  }
  await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const { signIn } = useAuth();

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  async function selectAccount(account: SavedAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
    // Auto-login when tapping a saved account chip
    setLoading(true);
    const { error: authError } = await signIn(account.email, account.password);
    if (authError) {
      setError('Email o contraseña incorrectos');
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Completar email y contraseña');
      return;
    }
    setLoading(true);
    setError(null);

    // Save before signIn — after signIn the screen unmounts
    if (rememberAccount) {
      await saveAccount(email.trim(), password);
    }

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      setError('Email o contraseña incorrectos');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)} style={styles.logoGroup}>
          <Image
            source={require('../../assets/logo-bayka.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Monitoreo de Plantaciones</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.fullWidth}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textPlaceholder}
            value={email}
            onChangeText={(text) => { setEmail(text); setError(null); }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.fullWidth}>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Contraseña"
            placeholderTextColor={colors.textPlaceholder}
            value={password}
            onChangeText={(text) => { setPassword(text); setError(null); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!loading}
          />
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={12}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.rememberRow}>
          <Switch
            value={rememberAccount}
            onValueChange={setRememberAccount}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={colors.white}
          />
          <Text style={styles.rememberText}>Recordar cuenta</Text>
        </View>
        </Animated.View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.fullWidth}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {savedAccounts.length > 0 && (
          <View style={styles.accountsSection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Acceso rapido</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.accountsChips}>
              {savedAccounts.map((account) => (
                <TouchableOpacity
                  key={account.email}
                  style={[
                    styles.accountChip,
                    email === account.email && styles.accountChipActive,
                  ]}
                  onPress={() => selectAccount(account)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.accountChipText,
                      email === account.email && styles.accountChipTextActive,
                    ]}
                  >
                    {account.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['5xl'],
    paddingVertical: spacing['6xl'],
  },
  logoImage: {
    width: 180,
    height: 80,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSubtle,
    marginBottom: spacing['5xl'],
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginBottom: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  passwordWrapper: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xxl,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  eyeButton: {
    paddingHorizontal: spacing.xxl,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  rememberText: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
    marginBottom: spacing.xl,
    alignSelf: 'flex-start',
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontFamily: fonts.semiBold,
  },
  fullWidth: {
    width: '100%',
  },
  logoGroup: {
    alignItems: 'center',
  },
  accountsSection: {
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing['4xl'],
    marginBottom: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: spacing.xl,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  accountChip: {
    backgroundColor: colors.surfacePressed,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountChipActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  accountChipText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.regular,
    color: colors.textMedium,
  },
  accountChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
});
