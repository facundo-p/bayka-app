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
import SubgrupoForm from '../components/SubgrupoForm';
import { useNewSubgroup } from '../hooks/useNewSubgroup';
import { useRoutePrefix } from '../hooks/useRoutePrefix';

export default function NuevoSubgrupoScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const routePrefix = useRoutePrefix();

  const { lastSubGroupName, handleCreateSubgroup } = useNewSubgroup(plantacionId);

  return (
    <ScreenContainer withTexture>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.sectionTitle}>Datos del subgrupo</Text>
          <SubgrupoForm
            mode="create"
            plantacionId={plantacionId ?? ''}
            lastSubGroupName={lastSubGroupName}
            onSubmit={async (values) => {
              const result = await handleCreateSubgroup(values);
              if (result.success) {
                router.replace(`/${routePrefix}/plantation/subgroup/${result.id}?plantacionId=${plantacionId}&subgrupoCodigo=${values.codigo.toUpperCase()}&subgrupoNombre=${encodeURIComponent(values.nombre)}` as any);
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
