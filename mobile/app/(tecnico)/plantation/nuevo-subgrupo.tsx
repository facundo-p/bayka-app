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
      setCodigoError('Este código ya existe en la plantación');
    } else {
      setCodigoError('Error al crear el SubGrupo. Intentá de nuevo.');
    }
  }

  const canSubmit = nombre.trim().length > 0 && codigo.trim().length > 0 && !!userId && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Datos del SubGrupo</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Línea 1"
            placeholderTextColor="#aaa"
            autoCapitalize="words"
          />
          {lastSubGroupName && (
            <Text style={styles.referenceText}>Último SubGrupo: {lastSubGroupName}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Código</Text>
          <TextInput
            style={[styles.input, codigoError ? styles.inputError : null]}
            value={codigo}
            onChangeText={(val) => {
              setCodigo(val.toUpperCase());
              if (codigoError) setCodigoError(null);
            }}
            placeholder="Ej: L1"
            placeholderTextColor="#aaa"
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
                Línea
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Crear SubGrupo</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#e53935',
  },
  referenceText: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#e53935',
    marginTop: 6,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d6a2d',
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segmentButtonActive: {
    backgroundColor: '#2d6a2d',
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d6a2d',
  },
  segmentLabelActive: {
    color: '#fff',
  },
  submitBtn: {
    backgroundColor: '#2d6a2d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#a5c9a5',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
