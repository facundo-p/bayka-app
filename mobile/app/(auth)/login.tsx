import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import * as SecureStore from 'expo-secure-store';

const EMAIL_KEY = 'last_email';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  // Pre-fill last successful email (per CONTEXT.md locked decision)
  useEffect(() => {
    SecureStore.getItemAsync(EMAIL_KEY).then(saved => {
      if (saved) setEmail(saved);
    });
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Completar email y contraseña');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      // Spanish error message per CONTEXT.md locked decision
      setError('Email o contraseña incorrectos');
      setLoading(false);
    }
    // On success: onAuthStateChange fires → useAuth updates session → root layout redirects
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text style={styles.logo}>Bayka</Text>
        <Text style={styles.subtitle}>Monitoreo de Plantaciones</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
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
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 40,
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
});
