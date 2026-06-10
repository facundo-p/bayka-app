import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenContainer from '../components/ScreenContainer';
import CustomHeader from '../components/CustomHeader';
import KeyboardAwareFormBody from '../components/KeyboardAwareFormBody';
import GrupoFields from '../components/GrupoFields';
import FormActions from '../components/FormActions';
import { useGrupoForm } from '../hooks/useGrupoForm';
import { useNewGroup } from '../hooks/useNewGroup';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { nuevoGrupoScreenStyles as styles } from './NuevoGrupoScreen.styles';

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

  return (
    <ScreenContainer withTexture>
      <CustomHeader title="Nuevo grupo" onBack={() => router.back()} />
      <KeyboardAwareFormBody
        footer={
          <FormActions
            submitLabel="Crear grupo"
            onSubmit={form.handleSubmit}
            submitDisabled={!form.canSubmit}
            loading={form.loading}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.sectionTitle}>Datos del grupo</Text>
          <GrupoFields form={form} lastGroupName={lastGroupName} />
        </Animated.View>
      </KeyboardAwareFormBody>
    </ScreenContainer>
  );
}
