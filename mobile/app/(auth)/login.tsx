import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import * as SecureStore from 'expo-secure-store';

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
        <Text style={styles.logo}>Bayka</Text>
        <Text style={styles.subtitle}>Monitoreo de Plantaciones</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(text) => { setEmail(text); setError(null); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#999"
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
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
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
    backgroundColor: '#fff',
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2d6a2d',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#2d6a2d',
    borderColor: '#2d6a2d',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 14,
    color: '#555',
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#2d6a2d',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#aaa',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountsSection: {
    width: '100%',
    marginTop: 24,
  },
  accountsTitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountChip: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  accountChipActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2d6a2d',
  },
  accountChipText: {
    fontSize: 15,
    color: '#333',
  },
  accountChipTextActive: {
    color: '#2d6a2d',
    fontWeight: '600',
  },
});
