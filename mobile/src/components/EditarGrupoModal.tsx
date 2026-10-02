import EntityFormModal from './EntityFormModal';
import FormActions from './FormActions';
import GrupoFields from './GrupoFields';
import { useGrupoForm } from '../hooks/useGrupoForm';
import type { GroupTipo, UpdateGroupResult } from '../repositories/GroupRepository';

interface Props {
  grupo: { nombre: string; codigo: string; tipo: GroupTipo };
  onClose: () => void;
  onSubmit: (values: { nombre: string; codigo: string; tipo: GroupTipo }) => Promise<UpdateGroupResult>;
  confirmar: (codigo: string) => Promise<boolean>;
  /** Modales anidados (aviso de cambio de IDs): viven dentro del Modal nativo. */
  extraContent?: React.ReactNode;
}

/** Edición de grupo en el template full-screen. Montarlo solo mientras se edita: el estado parte de `grupo`. */
export default function EditarGrupoModal({ grupo, onClose, onSubmit, confirmar, extraContent }: Props) {
  const form = useGrupoForm({ mode: 'edit', initialValues: grupo, onSubmit, confirmar });
  return (
    <EntityFormModal
      visible
      title="Editar grupo"
      onClose={onClose}
      extraContent={extraContent}
      footer={
        <FormActions
          submitLabel="Guardar"
          onSubmit={form.handleSubmit}
          submitDisabled={!form.canSubmit}
          loading={form.loading}
          onCancel={onClose}
        />
      }
    >
      <GrupoFields form={form} />
    </EntityFormModal>
  );
}
