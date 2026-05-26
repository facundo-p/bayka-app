import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, fonts } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import GrupoForm from '../components/GrupoForm';
import { useNewGroup } from '../hooks/useNewGroup';
import { useRoutePrefix } from '../hooks/useRoutePrefix';

export default function NuevoGrupoScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const routePrefix = useRoutePrefix();

  const { lastGroupName, handleCreateGroup } = useNewGroup(plantacionId);

  return (
    <ScreenContainer withTexture>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.sectionTitle}>Datos del subgrupo</Text>
          <GrupoForm
            mode="create"
            plantacionId={plantacionId ?? ''}
            lastGroupName={lastGroupName}
            onSubmit={async (values) => {
              const result = await handleCreateGroup(values);
              if (result.success) {
                router.replace(`/${routePrefix}/plantation/subgroup/${result.id}?plantacionId=${plantacionId}&grupoCodigo=${values.codigo.toUpperCase()}&grupoNombre=${encodeURIComponent(values.nombre)}` as any);
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
