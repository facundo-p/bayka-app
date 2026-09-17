import React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { getCachedEmails, getCachedPassword } from '../services/OfflineAuthService';
import { AUTH_MESSAGES } from '../supabase/authErrors';
import { colors } from '../theme';
import { loginScreenStyles as styles } from './LoginScreen.styles';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cachedEmails, setCachedEmails] = useState<string[]>([]);
  const { signIn } = useAuth();

  useEffect(() => {
    getCachedEmails().then(setCachedEmails);
  }, []);

  async function selectCachedEmail(emailValue: string) {
    setEmail(emailValue);
    setError(null);
    const cached = await getCachedPassword(emailValue);
    setPassword(cached ?? '');
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Completar email y contrasena');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await signIn(email.trim(), password);

      if (authError) {
        // signIn always returns a user-friendly message (see authErrors.ts).
        setError(authError.message || AUTH_MESSAGES.unknown);
        setLoading(false);
      }
    } catch {
      // signIn shouldn't throw, but never leak a raw error to the field user.
      setError(AUTH_MESSAGES.unknown);
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
            testID="email-input"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.fullWidth}>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Contrasena"
            placeholderTextColor={colors.textPlaceholder}
            value={password}
            onChangeText={(text) => { setPassword(text); setError(null); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!loading}
            testID="password-input"
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
        </Animated.View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.fullWidth}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            testID="login-button"
          >
            <Text style={styles.buttonText}>
              {loading ? 'Iniciando sesion...' : 'Iniciar sesion'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {cachedEmails.length > 0 && (
          <View style={styles.accountsSection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Acceso rapido</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.accountsChips}>
              {cachedEmails.map((emailItem) => (
                <TouchableOpacity
                  key={emailItem}
                  style={[
                    styles.accountChip,
                    email === emailItem && styles.accountChipActive,
                  ]}
                  onPress={() => selectCachedEmail(emailItem)}
                  disabled={loading}
                  activeOpacity={0.7}
                  testID={`email-chip-${emailItem}`}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.accountChipText,
                      email === emailItem && styles.accountChipTextActive,
                    ]}
                  >
                    {emailItem}
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
