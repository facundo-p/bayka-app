import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (lugar: string, periodo: string) => Promise<void>;
  /** When provided, the modal works in edit mode */
  editingPlantation?: Plantation | null;
};

export default function PlantationFormModal({
  visible,
  onClose,
  onSubmit,
  editingPlantation,
}: Props) {
  const isEdit = !!editingPlantation;

  const [lugar, setLugar] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLugar(editingPlantation?.lugar ?? '');
      setPeriodo(editingPlantation?.periodo ?? '');
      setError(null);
      setLoading(false);
    }
  }, [visible, editingPlantation]);

  function handleClose() {
    setError(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (lugar.trim().length < 2) {
      setError('Lugar debe tener al menos 2 caracteres.');
      return;
    }
    if (periodo.trim().length < 2) {
      setError('Periodo debe tener al menos 2 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(lugar.trim(), periodo.trim());
    } catch (e: any) {
      setError(
        e?.message ??
          (isEdit
            ? 'Error al actualizar la plantacion.'
            : 'Error al crear la plantacion.')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {isEdit ? 'Editar plantacion' : 'Nueva plantacion'}
          </Text>

          <Text style={styles.inputLabel}>Lugar</Text>
          <TextInput
            style={styles.textInput}
            value={lugar}
            onChangeText={setLugar}
            placeholder="Nombre del lugar de plantación"
            placeholderTextColor={colors.textPlaceholder}
            editable={!loading}
          />

          <Text style={styles.inputLabel}>Periodo</Text>
          <TextInput
            style={styles.textInput}
            value={periodo}
            onChangeText={setPeriodo}
            placeholder="Periodo de plantación"
            placeholderTextColor={colors.textPlaceholder}
            editable={!loading}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnCancel,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnPrimary,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>
                  {isEdit ? 'Guardar' : 'Crear'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.round,
    borderBottomRightRadius: borderRadius.round,
    padding: spacing['4xl'],
    paddingTop: spacing['6xl'],
    gap: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.backgroundAlt,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.dangerText,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: 44,
  },
  modalBtnCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnCancelText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
