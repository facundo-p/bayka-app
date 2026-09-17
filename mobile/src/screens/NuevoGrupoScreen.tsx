import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import EntityFormModal from '../components/EntityFormModal';
import FormActions from '../components/FormActions';
import GrupoFields from '../components/GrupoFields';
import { useGrupoForm } from '../hooks/useGrupoForm';
import { useNewGroup } from '../hooks/useNewGroup';
import { useRoutePrefix } from '../hooks/useRoutePrefix';

export default function NuevoGrupoScreen() {
  const { plantacionId, parcelaId } = useLocalSearchParams<{ plantacionId: string; parcelaId?: string }>();
  const router = useRouter();
  const routePrefix = useRoutePrefix();

  // Cannot create grupo without parcelaId — bounce back to parcelas list.
  useEffect(() => {
    if (!parcelaId && plantacionId) {
      router.replace(`/${routePrefix}/plantation/parcelas?plantacionId=${plantacionId}` as any);
    }
  }, [parcelaId, plantacionId, router, routePrefix]);

  const { lastGroupName, handleCreateGroup } = useNewGroup(plantacionId, parcelaId);

  const form = useGrupoForm({
    mode: 'create',
    onSubmit: async (values) => {
      const result = await handleCreateGroup(values);
      if (result.success) {
        router.replace(`/${routePrefix}/plantation/subgroup/${result.id}?plantacionId=${plantacionId}&parcelaId=${parcelaId}&grupoCodigo=${values.codigo.toUpperCase()}&grupoNombre=${encodeURIComponent(values.nombre)}` as any);
      }
      return result;
    },
  });

  if (!parcelaId) return null;

  // Mismo patrón que Parcela/Plantación (#89): modal full-screen, teclado-aware;
  // el back del SO cierra igual que la X/Cancelar.
  return (
    <EntityFormModal
      visible
      title="Nuevo grupo"
      onClose={() => router.back()}
      footer={
        <FormActions
          submitLabel="Crear grupo"
          onSubmit={form.handleSubmit}
          submitDisabled={!form.canSubmit}
          loading={form.loading}
          onCancel={() => router.back()}
        />
      }
    >
      <GrupoFields form={form} lastGroupName={lastGroupName} />
    </EntityFormModal>
  );
}
