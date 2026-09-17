import { View } from 'react-native';
import GrupoFields from './GrupoFields';
import FormActions from './FormActions';
import { useGrupoForm } from '../hooks/useGrupoForm';
import { grupoFormStyles as styles } from './GrupoForm.styles';
import type {
  GroupTipo,
  CreateGroupResult,
  UpdateGroupResult,
} from '../repositories/GroupRepository';

interface Props {
  mode: 'create' | 'edit';
  /** Aceptado por compatibilidad con call sites; no se usa internamente. */
  plantacionId?: string;
  initialValues?: { nombre: string; codigo: string; tipo: GroupTipo };
  onSubmit: (values: {
    nombre: string;
    codigo: string;
    tipo: GroupTipo;
  }) => Promise<CreateGroupResult | UpdateGroupResult>;
  onCancel?: () => void;
  lastGroupName?: string | null;
}

/**
 * Formulario de grupo con botonera inline (bottom-sheet de edición). Para la
 * creación, NuevoGrupoScreen compone useGrupoForm + GrupoFields con la
 * botonera en un footer fijo para que "Crear grupo" no quede tapado por el
 * teclado (#89). Ambos comparten estado vía useGrupoForm.
 */
export default function GrupoForm({ mode, initialValues, onSubmit, onCancel, lastGroupName }: Props) {
  const form = useGrupoForm({ mode, initialValues, onSubmit });
  return (
    <View>
      <GrupoFields form={form} lastGroupName={mode === 'create' ? lastGroupName : null} />
      <View style={styles.actions}>
        <FormActions
          submitLabel={mode === 'create' ? 'Crear grupo' : 'Guardar'}
          onSubmit={form.handleSubmit}
          submitDisabled={!form.canSubmit}
          loading={form.loading}
          onCancel={mode === 'edit' ? onCancel : undefined}
        />
      </View>
    </View>
  );
}
