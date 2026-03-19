import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createSubGroup, getLastSubGroupName } from '../repositories/SubGroupRepository';
import { colors, fontSize, spacing } from '../theme';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import SubgrupoForm from '../components/SubgrupoForm';

export default function NuevoSubgrupoScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const userId = useCurrentUserId();

  const [lastSubGroupName, setLastSubGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!plantacionId) return;
    getLastSubGroupName(plantacionId).then(setLastSubGroupName);
  }, [plantacionId]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Datos del subgrupo</Text>

        <SubgrupoForm
          mode="create"
          plantacionId={plantacionId ?? ''}
          lastSubGroupName={lastSubGroupName}
          onSubmit={async (values) => {
            if (!userId) {
              return { success: false as const, error: 'unknown' as const };
            }
            const result = await createSubGroup({
              plantacionId: plantacionId ?? '',
              nombre: values.nombre,
              codigo: values.codigo,
              tipo: values.tipo,
              usuarioCreador: userId,
            });
            if (result.success) {
              router.back();
            }
            return result;
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    padding: spacing.xxxl,
  },
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xxxl,
  },
});
