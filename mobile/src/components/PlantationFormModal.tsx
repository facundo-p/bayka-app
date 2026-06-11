import { useState, useEffect } from 'react';
import { Switch, Text, View } from 'react-native';
import { GPS_CAPTURE_FREQUENCY_DEFAULT } from '../constants/gpsCapture';
import type { PlantationGpsSettings } from '../repositories/PlantationRepository';
import { colors } from '../theme';
import FormField from './FormField';
import EntityFormModal from './EntityFormModal';
import FormActions from './FormActions';
import { plantationFormModalStyles as styles } from './PlantationFormModal.styles';

type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
  gpsCaptureFrequency?: number;
  gpsCaptureRequired?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (lugar: string, periodo: string, gps: PlantationGpsSettings) => Promise<void>;
  /** When provided, the modal works in edit mode */
  editingPlantation?: Plantation | null;
};

/** Valida el campo de frecuencia: entero ≥ 1. Devuelve mensaje de error o null. */
export function validateGpsFrequency(raw: string): string | null {
  const value = Number(raw.trim());
  if (raw.trim() === '' || !Number.isInteger(value) || value < 1) {
    return 'La frecuencia debe ser un número entero mayor o igual a 1.';
  }
  return null;
}

/**
 * Creación/edición de plantación. Full-screen coherente con Parcela y Grupo
 * (#89): header verde con safe-area, cuerpo keyboard-aware y footer fijo.
 * Solo lo monta el flujo admin (AdminPlantationModals); el técnico nunca lo ve.
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
  const [gpsFrequency, setGpsFrequency] = useState(String(GPS_CAPTURE_FREQUENCY_DEFAULT));
  const [gpsRequired, setGpsRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLugar(editingPlantation?.lugar ?? '');
      setPeriodo(editingPlantation?.periodo ?? '');
      setGpsFrequency(String(editingPlantation?.gpsCaptureFrequency ?? GPS_CAPTURE_FREQUENCY_DEFAULT));
      setGpsRequired(editingPlantation?.gpsCaptureRequired ?? true);
      setError(null);
      setLoading(false);
    }
  }, [visible, editingPlantation]);

  function handleClose() {
    setError(null);
    setLoading(false);
    onClose();
  }

  function validate(): string | null {
    if (lugar.trim().length < 2) return 'Lugar debe tener al menos 2 caracteres.';
    if (periodo.trim().length < 2) return 'Periodo debe tener al menos 2 caracteres.';
    return validateGpsFrequency(gpsFrequency);
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(lugar.trim(), periodo.trim(), {
        gpsCaptureFrequency: Number(gpsFrequency.trim()),
        gpsCaptureRequired: gpsRequired,
      });
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
      <FormField
        label="Capturar GPS cada N árboles"
        value={gpsFrequency}
        onChangeText={setGpsFrequency}
        placeholder={String(GPS_CAPTURE_FREQUENCY_DEFAULT)}
        keyboardType="numeric"
        editable={!loading}
        helperText="1 = todos los árboles. El primero de cada grupo siempre captura."
      />
      <View style={styles.switchRow}>
        <View style={styles.switchLabels}>
          <Text style={styles.switchLabel}>Captura GPS obligatoria</Text>
          <Text style={styles.switchHelper}>
            Si está activa, registrar árboles exige GPS encendido y con permiso.
          </Text>
        </View>
        <Switch
          testID="gps-required-switch"
          value={gpsRequired}
          onValueChange={setGpsRequired}
          disabled={loading}
          trackColor={{ false: colors.border, true: colors.gpsGood }}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </EntityFormModal>
  );
}
