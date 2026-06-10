/**
 * ParcelaFormModal — full-screen modal for create + edit parcela (D-17-01).
 *
 * Single component with `mode: 'create' | 'edit'` (CLAUDE.md §8, D-17-01).
 * Live char counter for descripcion turns warning at >=9000 (D-17-02).
 * Uniqueness validated on submit (D-17-03).
 * Delete blocked by children with error modal (D-17-04).
 *
 * Chrome (header + cuerpo keyboard-aware + footer) delegado a EntityFormModal /
 * FormActions, compartido con las demás pantallas de creación (#89).
 */
import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import FormField from './FormField';
import ConfirmModal from './ConfirmModal';
import EntityFormModal from './EntityFormModal';
import FormActions from './FormActions';
import { useNewParcela } from '../hooks/useNewParcela';
import { colors } from '../theme';
import { parcelaFormModalStyles as styles } from './ParcelaFormModal.styles';
import type { Parcela } from '../repositories/ParcelaRepository';

const MAX_DESCRIPCION = 10000;
const DESCRIPCION_WARN_THRESHOLD = 9000;

interface Props {
  visible: boolean;
  mode: 'create' | 'edit';
  plantacionId: string;
  parcela?: Parcela | null;
  onClose: () => void;
}

interface ErrorState {
  nombre: string | null;
  codigo: string | null;
  general: string | null;
}

function DescripcionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isWarn = value.length >= DESCRIPCION_WARN_THRESHOLD;
  return (
    <View style={styles.descripcionWrap}>
      <Text style={styles.descripcionLabel}>Descripción (opcional)</Text>
      <TextInput
        style={styles.descripcionInput}
        value={value}
        onChangeText={onChange}
        placeholder="Notas, ubicación, observaciones..."
        placeholderTextColor={colors.textLight}
        multiline
        maxLength={MAX_DESCRIPCION}
      />
      <Text style={[styles.descripcionCounter, isWarn && styles.descripcionCounterWarn]}>
        {value.length} / {MAX_DESCRIPCION}
      </Text>
    </View>
  );
}

function applyDuplicateError(error: string): ErrorState {
  if (error === 'both_duplicate') {
    return {
      nombre: 'Ya existe una parcela con ese nombre en esta plantación',
      codigo: 'Ya existe una parcela con ese código en esta plantación',
      general: null,
    };
  }
  if (error === 'nombre_duplicate') {
    return { nombre: 'Ya existe una parcela con ese nombre en esta plantación', codigo: null, general: null };
  }
  if (error === 'codigo_duplicate') {
    return { nombre: null, codigo: 'Ya existe una parcela con ese código en esta plantación', general: null };
  }
  if (error === 'descripcion_too_long') {
    return { nombre: null, codigo: null, general: 'La descripción supera el límite de 10.000 caracteres' };
  }
  return { nombre: null, codigo: null, general: 'Error al guardar. Intentá de nuevo.' };
}

export default function ParcelaFormModal({ visible, mode, plantacionId, parcela, onClose }: Props) {
  const { handleCreateParcela, handleUpdateParcela, handleDeleteParcela } = useNewParcela(plantacionId);
  const [nombre, setNombre] = useState(parcela?.nombre ?? '');
  const [codigo, setCodigo] = useState(parcela?.codigo ?? '');
  const [descripcion, setDescripcion] = useState(parcela?.descripcion ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ErrorState>({ nombre: null, codigo: null, general: null });
  const [hasChildrenError, setHasChildrenError] = useState<number | null>(null);

  const canSubmit = nombre.trim().length > 0 && codigo.trim().length > 0 && !loading;

  function handleNombreChange(v: string) {
    setNombre(v);
    if (errors.nombre) setErrors((e) => ({ ...e, nombre: null }));
  }

  function handleCodigoChange(v: string) {
    setCodigo(v.toUpperCase());
    if (errors.codigo) setErrors((e) => ({ ...e, codigo: null }));
  }

  function clearAndClose() {
    setNombre('');
    setCodigo('');
    setDescripcion('');
    setErrors({ nombre: null, codigo: null, general: null });
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setErrors({ nombre: null, codigo: null, general: null });
    setLoading(true);
    try {
      const values = {
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase(),
        descripcion: descripcion.trim().length > 0 ? descripcion : null,
      };
      const result = mode === 'create'
        ? await handleCreateParcela(values)
        : await handleUpdateParcela(parcela!.id, values);
      if (!result.success) {
        setErrors(applyDuplicateError(result.error));
        return;
      }
      clearAndClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!parcela) return;
    setLoading(true);
    try {
      const result = await handleDeleteParcela(parcela.id);
      if (result.deleted) {
        clearAndClose();
        return;
      }
      if (result.error === 'has_children') {
        setHasChildrenError(result.childCount);
      } else {
        setErrors((e) => ({ ...e, general: 'No se pudo eliminar la parcela.' }));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntityFormModal
      visible={visible}
      title={mode === 'create' ? 'Nueva parcela' : 'Editar parcela'}
      onClose={clearAndClose}
      extraContent={
        <ConfirmModal
          visible={hasChildrenError !== null}
          icon="alert-circle"
          iconColor={colors.danger}
          title="No se puede eliminar"
          message={`Esta parcela tiene ${hasChildrenError ?? 0} grupo${hasChildrenError === 1 ? '' : 's'} asociado${hasChildrenError === 1 ? '' : 's'}. Eliminá los grupos antes de borrar la parcela.`}
          buttons={[{ label: 'Entendido', onPress: () => setHasChildrenError(null), style: 'primary' }]}
          onDismiss={() => setHasChildrenError(null)}
        />
      }
      footer={
        <FormActions
          submitLabel={mode === 'create' ? 'Crear parcela' : 'Guardar'}
          onSubmit={handleSubmit}
          submitDisabled={!canSubmit}
          loading={loading}
          onCancel={clearAndClose}
          cancelDisabled={loading}
        />
      }
    >
      <FormField
        label="Nombre"
        value={nombre}
        onChangeText={handleNombreChange}
        placeholder="Ej: Lote Norte"
        error={errors.nombre}
        autoCapitalize="words"
      />
      <FormField
        label="Código"
        value={codigo}
        onChangeText={handleCodigoChange}
        placeholder="Ej: LN"
        error={errors.codigo}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <DescripcionField value={descripcion} onChange={setDescripcion} />
      {errors.general && (
        <Text style={[styles.descripcionCounter, styles.descripcionCounterWarn]}>{errors.general}</Text>
      )}
      {mode === 'edit' && (
        <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
          <Text style={styles.deleteText}>Eliminar parcela</Text>
        </Pressable>
      )}
    </EntityFormModal>
  );
}
