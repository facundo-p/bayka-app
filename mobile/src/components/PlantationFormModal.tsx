import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import FormField from './FormField';
import EntityFormModal from './EntityFormModal';
import FormActions from './FormActions';
import { plantationFormModalStyles as styles } from './PlantationFormModal.styles';

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

/**
 * Creación/edición de plantación. Full-screen coherente con Parcela y Grupo
 * (#89): header verde con safe-area, cuerpo keyboard-aware y footer fijo.
 * Antes era un sheet centrado (BaseModal) sin keyboard avoidance.
 */
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
          (isEdit ? 'Error al actualizar la plantacion.' : 'Error al crear la plantacion.')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntityFormModal
      visible={visible}
      title={isEdit ? 'Editar plantacion' : 'Nueva plantacion'}
      onClose={handleClose}
      footer={
        <FormActions
          submitLabel={isEdit ? 'Guardar' : 'Crear'}
          onSubmit={handleSubmit}
          submitDisabled={loading}
          loading={loading}
          onCancel={handleClose}
          cancelDisabled={loading}
        />
      }
    >
      <FormField
        label="Lugar"
        value={lugar}
        onChangeText={setLugar}
        placeholder="Nombre del lugar de plantación"
        editable={!loading}
      />
      <FormField
        label="Periodo"
        value={periodo}
        onChangeText={setPeriodo}
        placeholder="Periodo de plantación"
        editable={!loading}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </EntityFormModal>
  );
}
