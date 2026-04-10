import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, fonts } from '../theme';
import SubgrupoForm from '../components/SubgrupoForm';
import { useNewSubgroup } from '../hooks/useNewSubgroup';

export default function NuevoSubgrupoScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { lastSubGroupName, handleCreateSubgroup } = useNewSubgroup(plantacionId);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: insets.bottom }]}
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
                router.back();
              }
              return result;
            }}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.xxxl },
  sectionTitle: { fontSize: fontSize.title, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.xxxl },
});
