import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import * as SecureStore from 'expo-secure-store';
import { colors, fontSize, spacing, borderRadius } from '../../src/theme';

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const { signIn } = useAuth();

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  function selectAccount(account: SavedAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Completar email y contrasena');
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
      setError('Email o contrasena incorrectos');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Bayka</Text>
        <Text style={styles.subtitle}>Monitoreo de Plantaciones</Text>

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

        <TextInput
          style={styles.input}
          placeholder="Contrasena"
          placeholderTextColor={colors.textPlaceholder}
          value={password}
          onChangeText={(text) => { setPassword(text); setError(null); }}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberAccount(!rememberAccount)}
          activeOpacity={0.7}
          disabled={loading}
        >
          <View style={[styles.checkbox, rememberAccount && styles.checkboxChecked]}>
            {rememberAccount && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Recordar cuenta</Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Iniciando sesion...' : 'Iniciar sesion'}
          </Text>
        </TouchableOpacity>

        {savedAccounts.length > 0 && (
          <View style={styles.accountsSection}>
            <Text style={styles.accountsTitle}>Cuentas guardadas</Text>
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
                <Text style={[
                  styles.accountChipText,
                  email === account.email && styles.accountChipTextActive,
                ]}>
                  {account.email}
                </Text>
              </TouchableOpacity>
            ))}
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
  logo: {
    fontSize: fontSize.hero,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.base,
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
    color: colors.textDark,
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceAlt,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.borderMuted,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: fontSize.base,
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
    fontWeight: '600',
  },
  accountsSection: {
    width: '100%',
    marginTop: spacing['4xl'],
  },
  accountsTitle: {
    fontSize: fontSize.md,
    color: colors.textPlaceholder,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountChip: {
    backgroundColor: colors.surfacePressed,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountChipActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  accountChipText: {
    fontSize: fontSize.lg,
    color: colors.textMedium,
  },
  accountChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
