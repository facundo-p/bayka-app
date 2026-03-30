import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import FormField from './FormField';
import TipoSegmentedControl from './TipoSegmentedControl';
import type {
  SubGroupTipo,
  CreateSubGroupResult,
  UpdateSubGroupResult,
} from '../repositories/SubGroupRepository';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  mode: 'create' | 'edit';
  plantacionId: string;
  initialValues?: { nombre: string; codigo: string; tipo: SubGroupTipo };
  onSubmit: (values: {
    nombre: string;
    codigo: string;
    tipo: SubGroupTipo;
  }) => Promise<CreateSubGroupResult | UpdateSubGroupResult>;
  onCancel?: () => void;
  lastSubGroupName?: string | null;
}

export default function SubgrupoForm({
  mode,
  plantacionId,
  initialValues,
  onSubmit,
  onCancel,
  lastSubGroupName,
}: Props) {
  const [nombre, setNombre] = useState(initialValues?.nombre ?? '');
  const [codigo, setCodigo] = useState(initialValues?.codigo ?? '');
  const [tipo, setTipo] = useState<SubGroupTipo>(initialValues?.tipo ?? 'linea');
  const [loading, setLoading] = useState(false);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [codigoError, setCodigoError] = useState<string | null>(null);

  const canSubmit = nombre.trim().length > 0 && codigo.trim().length > 0 && !loading;

  function handleNombreChange(val: string) {
    setNombre(val);
    if (nombreError) setNombreError(null);
  }

  function handleCodigoChange(val: string) {
    setCodigo(val.toUpperCase());
    if (codigoError) setCodigoError(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setNombreError(null);
    setCodigoError(null);
    setLoading(true);

    try {
      const result = await onSubmit({
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase(),
        tipo,
      });

      if (!result.success) {
        if (result.error === 'both_duplicate') {
          setNombreError('Este nombre ya existe en la plantación');
          setCodigoError('Este código ya existe en la plantación');
        } else if (result.error === 'nombre_duplicate') {
          setNombreError('Este nombre ya existe en la plantación');
        } else if (result.error === 'codigo_duplicate') {
          setCodigoError('Este código ya existe en la plantación');
        } else {
          setCodigoError(
            mode === 'create'
              ? 'Error al crear el subgrupo. Intentá de nuevo.'
              : 'Error al actualizar. Intentá de nuevo.',
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = mode === 'create' ? 'Crear subgrupo' : 'Guardar';

  return (
    <View>
      <FormField
        label="Nombre"
        value={nombre}
        onChangeText={handleNombreChange}
        placeholder="Ej: Linea 1"
        error={nombreError}
        autoCapitalize="words"
        helperText={
          mode === 'create' && lastSubGroupName
            ? `Último subgrupo: ${lastSubGroupName}`
            : null
        }
      />

      <FormField
        label="Código"
        value={codigo}
        onChangeText={handleCodigoChange}
        placeholder="Ej: L1"
        error={codigoError}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <TipoSegmentedControl value={tipo} onChange={setTipo} />

      <View style={mode === 'edit' ? styles.editActions : undefined}>
        {mode === 'edit' && onCancel && (
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        )}
        <Pressable
          style={[
            mode === 'edit' ? styles.editSubmitBtn : styles.submitBtn,
            !canSubmit && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.borderMuted,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.lg,
  },
  editSubmitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryFaded,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
});
