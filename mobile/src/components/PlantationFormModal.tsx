import { useState, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { GPS_CAPTURE_FREQUENCY_DEFAULT } from '../constants/gpsCapture';
import { colors } from '../theme';
import type { CamposDePlantacion } from '../utils/camposDePlantacion';
import { buscarDuplicada } from '../utils/duplicadoDePlantacion';
import {
  aCamposDePlantacion,
  validarFormulario,
  valoresIniciales,
  type PlantacionEditable,
  type ValoresDelFormulario,
} from '../utils/formularioDePlantacion';
import type { Plantation } from '../types/plantation';
import FormField from './FormField';
import CampoFecha from './CampoFecha';
import SwitchRow from './SwitchRow';
import EntityFormModal from './EntityFormModal';
import FormActions from './FormActions';
import AvisoPlantacionDuplicada from './AvisoPlantacionDuplicada';
import { plantationFormModalStyles as styles } from './PlantationFormModal.styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (campos: CamposDePlantacion) => Promise<void>;
  /** When provided, the modal works in edit mode */
  editingPlantation?: (PlantacionEditable & { id: string }) | null;
  /** Plantaciones del dispositivo, para avisar si lugar + periodo ya existe. */
  plantaciones?: readonly Plantation[] | null;
};

type Setter = <K extends keyof ValoresDelFormulario>(campo: K) => (valor: ValoresDelFormulario[K]) => void;
type SeccionProps = { valores: ValoresDelFormulario; set: Setter; editable: boolean };

function DatosDeLaPlantacion({ valores, set, editable, duplicada, editando }: SeccionProps & {
  duplicada: Plantation | null;
  editando: boolean;
}) {
  return (
    <>
      <View style={styles.fila}>
        <View style={styles.columna}>
          <FormField label="Lugar" value={valores.lugar} onChangeText={set('lugar')} placeholder="Lote Norte" editable={editable} />
        </View>
        <View style={styles.columna}>
          <FormField label="Periodo" value={valores.periodo} onChangeText={set('periodo')} placeholder="Otoño 2026" editable={editable} />
        </View>
      </View>
      {duplicada ? <AvisoPlantacionDuplicada lugar={duplicada.lugar} periodo={duplicada.periodo} editando={editando} /> : null}
      <View style={styles.fila}>
        <View style={styles.columna}>
          <CampoFecha
            testID="fecha-inicio"
            label="Fecha de inicio (opcional)"
            value={valores.fechaInicio}
            onChange={set('fechaInicio')}
            placeholder="DD/MM/AAAA"
            editable={editable}
          />
        </View>
        <View style={styles.columna}>
          <FormField
            label="Objetivo (árboles)"
            value={valores.objetivoArboles}
            onChangeText={set('objetivoArboles')}
            placeholder="Opcional"
            keyboardType="numeric"
            editable={editable}
          />
        </View>
      </View>
      <FormField
        label="Descripción (opcional)"
        value={valores.descripcion}
        onChangeText={set('descripcion')}
        placeholder="Notas, ubicación, observaciones..."
        multiline
        editable={editable}
      />
    </>
  );
}

function ComportamientoEnCampo({ valores, set, editable }: SeccionProps) {
  return (
    <>
      <Text style={styles.grupoTitulo}>Comportamiento en campo</Text>
      <SwitchRow
        testID="gps-required-switch"
        label="Captura GPS obligatoria"
        helperText="Si está activa, registrar árboles exige GPS encendido y con permiso."
        value={valores.gpsRequired}
        onValueChange={set('gpsRequired')}
        disabled={!editable}
        activeColor={colors.gpsGood}
      />
      <FormField
        label="Capturar GPS cada N árboles"
        value={valores.gpsFrequency}
        onChangeText={set('gpsFrequency')}
        placeholder={String(GPS_CAPTURE_FREQUENCY_DEFAULT)}
        keyboardType="numeric"
        editable={editable}
        helperText="1 = todos los árboles. El primero de cada grupo siempre captura."
      />
      <SwitchRow
        testID="foto-en-todos-switch"
        label="Foto en todos los botones"
        helperText="Cada especie pide foto al registrar, no solo N/N."
        value={valores.fotoEnTodos}
        onValueChange={set('fotoEnTodos')}
        disabled={!editable}
      />
      <SwitchRow
        testID="visible-tecnicos-switch"
        label="Visible para técnicos"
        helperText="Si está apagada, los técnicos no la ven en su listado."
        value={valores.visibleParaTecnicos}
        onValueChange={set('visibleParaTecnicos')}
        disabled={!editable}
      />
    </>
  );
}

/**
 * Creación/edición de plantación con todos sus datos en un solo formulario (#633).
 * Solo lo monta el flujo admin (AdminPlantationModals); el técnico nunca lo ve.
 */
export default function PlantationFormModal({ visible, onClose, onSubmit, editingPlantation, plantaciones }: Props) {
  const isEdit = !!editingPlantation;

  const [valores, setValores] = useState<ValoresDelFormulario>(() => valoresIniciales(editingPlantation));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValores(valoresIniciales(editingPlantation));
      setError(null);
      setLoading(false);
    }
  }, [visible, editingPlantation]);

  const duplicada = useMemo(
    () => buscarDuplicada(plantaciones ?? [], valores, editingPlantation?.id),
    [plantaciones, valores, editingPlantation?.id],
  );

  const set: Setter = (campo) => (valor) => setValores((actuales) => ({ ...actuales, [campo]: valor }));

  function handleClose() {
    setError(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    const validationError = validarFormulario(valores);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(aCamposDePlantacion(valores));
    } catch (e: any) {
      setError(e?.message ?? (isEdit ? 'Error al actualizar la plantación.' : 'Error al crear la plantación.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntityFormModal
      visible={visible}
      title={isEdit ? 'Editar plantación' : 'Nueva plantación'}
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
      <DatosDeLaPlantacion valores={valores} set={set} editable={!loading} duplicada={duplicada} editando={isEdit} />
      <ComportamientoEnCampo valores={valores} set={set} editable={!loading} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </EntityFormModal>
  );
}
