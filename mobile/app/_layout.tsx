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
import { colors, fontSize, spacing, fonts } from '../src/theme';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Keep splash visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const { session, role, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    // Linux Biolinum — brand heading font (loaded from local assets)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LinBiolinum_R: require('../assets/fonts/LinBiolinum_R.otf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LinBiolinum_RB: require('../assets/fonts/LinBiolinum_RB.otf'),
  });

  // Hide splash when fonts + migrations are ready
  useEffect(() => {
    if (fontsLoaded && success) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, success]);

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
    if (!success || loading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inTecnicoGroup = segments[0] === '(tecnico)';

    if (!session || !role) {
      // Not logged in or no confirmed role → login screen
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
  }, [success, loading, session, role, segments, fontsLoaded]);

  // Migration error — unrecoverable
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.errorTitle, { fontFamily: fonts.bold }]}>Error de base de datos</Text>
        <Text style={[styles.errorBody, { fontFamily: fonts.regular }]}>Contactar soporte</Text>
        <Text style={[styles.errorDetail, { fontFamily: fonts.light }]}>{error.message}</Text>
      </View>
    );
  }

  // Migrations or fonts loading
  if (!success || !fontsLoaded) {
    return null; // Splash screen is visible
  }

  // Auth loading
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { fontFamily: fonts.regular }]}>Iniciando sesión...</Text>
      </View>
    );
  }

  // Always render Slot — navigation happens via router.replace in useEffect
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Slot />
    </SafeAreaProvider>
  );
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
