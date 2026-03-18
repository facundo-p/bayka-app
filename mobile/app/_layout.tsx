import 'react-native-url-polyfill/auto'; // MUST be first import

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../src/database/client';
import { useAuth } from '../src/hooks/useAuth';
import { Slot, useRouter, useSegments } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { seedSpeciesIfNeeded } from '../src/database/seeds/seedSpecies';
import { seedPlantationIfNeeded } from '../src/database/seeds/seedPlantation';
import { seedPlantationSpeciesIfNeeded } from '../src/database/seeds/seedPlantationSpecies';
import { colors, fontSize, spacing } from '../src/theme';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const { session, role, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Run species seed after migrations succeed
  useEffect(() => {
    if (success) {
      seedSpeciesIfNeeded()
        .then(() => seedPlantationIfNeeded())
        .then(() => seedPlantationSpeciesIfNeeded())
        .catch(console.error);
    }
  }, [success]);

  // Redirect based on auth state — after layout is mounted
  useEffect(() => {
    if (!success || loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inTecnicoGroup = segments[0] === '(tecnico)';

    if (!session) {
      // Not logged in → login screen
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (role === 'admin') {
      if (!inAdminGroup) {
        router.replace('/(admin)/plantaciones');
      }
    } else {
      if (!inTecnicoGroup) {
        router.replace('/(tecnico)/plantaciones');
      }
    }
  }, [success, loading, session, role, segments]);

  // Migration error — unrecoverable
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Error de base de datos</Text>
        <Text style={styles.errorBody}>Contactar soporte</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  // Migrations running
  if (!success) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Inicializando...</Text>
      </View>
    );
  }

  // Auth loading
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Iniciando sesion...</Text>
      </View>
    );
  }

  // Always render Slot — navigation happens via router.replace in useEffect
  return <Slot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing['4xl'],
  },
  loadingText: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.dangerText,
    marginBottom: spacing.md,
  },
  errorBody: {
    fontSize: fontSize.lg,
    color: colors.textMedium,
    marginBottom: spacing.xxl,
  },
  errorDetail: {
    fontSize: fontSize.sm,
    color: colors.textPlaceholder,
    textAlign: 'center',
  },
});
