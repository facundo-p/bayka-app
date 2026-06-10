import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, fonts } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import CustomHeader from '../components/CustomHeader';
import GrupoForm from '../components/GrupoForm';
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

  if (!parcelaId) return null;

  return (
    <ScreenContainer withTexture>
    <CustomHeader title="Nuevo grupo" onBack={() => router.back()} />
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.sectionTitle}>Datos del grupo</Text>
          <GrupoForm
            mode="create"
            plantacionId={plantacionId ?? ''}
            lastGroupName={lastGroupName}
            onSubmit={async (values) => {
              const result = await handleCreateGroup(values);
              if (result.success) {
                router.replace(`/${routePrefix}/plantation/subgroup/${result.id}?plantacionId=${plantacionId}&parcelaId=${parcelaId}&grupoCodigo=${values.codigo.toUpperCase()}&grupoNombre=${encodeURIComponent(values.nombre)}` as any);
              }
              return result;
            }}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.xxxl },
  sectionTitle: { fontSize: fontSize.title, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.xxxl },
});
