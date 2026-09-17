import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import EntityFormModal from '../components/EntityFormModal';
import FormActions from '../components/FormActions';
import GrupoFields from '../components/GrupoFields';
import { PlantacionNoEditableBanner } from '../components/PlantationDetailHeader';
import { useGrupoForm } from '../hooks/useGrupoForm';
import { useNewGroup } from '../hooks/useNewGroup';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { nuevoGrupoScreenStyles as styles } from './NuevoGrupoScreen.styles';

function PlantacionBloqueada({ isArchivada }: { isArchivada: boolean }) {
  return (
    <View style={styles.bloqueo}>
      <PlantacionNoEditableBanner isArchivada={isArchivada} />
      <Text style={styles.bloqueoTexto}>
        {`No se pueden crear grupos en una plantación ${isArchivada ? 'archivada' : 'finalizada'}.`}
      </Text>
    </View>
  );
}

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

  const { lastGroupName, handleCreateGroup, estadoLoaded, plantacionEditable, isArchivada } =
    useNewGroup(plantacionId, parcelaId);
  // No depende de que el "+" esté oculto: la ruta se puede abrir igual, y un pull
  // puede finalizar o archivar la plantación con la pantalla abierta.
  const bloqueada = estadoLoaded && !plantacionEditable;

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
          submitDisabled={!form.canSubmit || !plantacionEditable}
          loading={form.loading}
          onCancel={() => router.back()}
        />
      }
    >
      {bloqueada ? (
        <PlantacionBloqueada isArchivada={isArchivada} />
      ) : (
        <GrupoFields form={form} lastGroupName={lastGroupName} />
      )}
    </EntityFormModal>
  );
}
