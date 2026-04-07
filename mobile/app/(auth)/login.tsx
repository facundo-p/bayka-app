import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../src/hooks/useAuth';
import { getCachedEmails, getCachedPassword } from '../../src/services/OfflineAuthService';
import { colors, fontSize, spacing, borderRadius, fonts } from '../../src/theme';

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

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      setError(authError.message || 'Email o contrasena incorrectos');
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
            placeholder="Contrasena"
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
