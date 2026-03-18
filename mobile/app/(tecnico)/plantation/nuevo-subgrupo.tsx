import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createSubGroup, getLastSubGroupName } from '../../../src/repositories/SubGroupRepository';
import type { SubGroupTipo } from '../../../src/repositories/SubGroupRepository';
import { supabase, isSupabaseConfigured } from '../../../src/supabase/client';
import { colors, fontSize, spacing, borderRadius } from '../../../src/theme';

export default function NuevoSubGrupo() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<SubGroupTipo>('linea');
  const [loading, setLoading] = useState(false);
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [lastSubGroupName, setLastSubGroupName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!plantacionId) return;
    getLastSubGroupName(plantacionId).then(setLastSubGroupName);
  }, [plantacionId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  async function handleSubmit() {
    if (!nombre.trim() || !codigo.trim() || !plantacionId || !userId) return;

    setCodigoError(null);
    setLoading(true);

    const result = await createSubGroup({
      plantacionId,
      nombre: nombre.trim(),
      codigo: codigo.trim().toUpperCase(),
      tipo,
      usuarioCreador: userId,
    });

    setLoading(false);

    if (result.success) {
      router.back();
    } else if (result.error === 'codigo_duplicate') {
      setCodigoError('Este codigo ya existe en la plantacion');
    } else {
      setCodigoError('Error al crear el subgrupo. Intenta de nuevo.');
    }
  }

  const canSubmit = nombre.trim().length > 0 && codigo.trim().length > 0 && !!userId && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Datos del subgrupo</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Linea 1"
            placeholderTextColor={colors.textLight}
            autoCapitalize="words"
          />
          {lastSubGroupName && (
            <Text style={styles.referenceText}>Ultimo subgrupo: {lastSubGroupName}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Codigo</Text>
          <TextInput
            style={[styles.input, codigoError ? styles.inputError : null]}
            value={codigo}
            onChangeText={(val) => {
              setCodigo(val.toUpperCase());
              if (codigoError) setCodigoError(null);
            }}
            placeholder="Ej: L1"
            placeholderTextColor={colors.textLight}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {codigoError && <Text style={styles.errorText}>{codigoError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segmentButton, tipo === 'linea' && styles.segmentButtonActive]}
              onPress={() => setTipo('linea')}
            >
              <Text style={[styles.segmentLabel, tipo === 'linea' && styles.segmentLabelActive]}>
                Linea
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentButton, tipo === 'parcela' && styles.segmentButtonActive]}
              onPress={() => setTipo('parcela')}
            >
              <Text style={[styles.segmentLabel, tipo === 'parcela' && styles.segmentLabelActive]}>
                Parcela
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Crear subgrupo</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    padding: spacing.xxxl,
  },
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xxxl,
  },
  field: {
    marginBottom: spacing.xxxl,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMedium,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: spacing.xl,
    fontSize: fontSize.xl,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  inputError: {
    borderColor: colors.dangerLight,
  },
  referenceText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.dangerLight,
    marginTop: spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.primary,
  },
  segmentLabelActive: {
    color: colors.white,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryFaded,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
});
