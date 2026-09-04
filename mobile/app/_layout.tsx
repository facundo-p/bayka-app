import 'react-native-url-polyfill/auto'; // must be first import

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../src/database/client';
import { useAuth } from '../src/hooks/useAuth';
import { esRolAdmin } from '../src/types/domain';
import { Slot, useRouter, useSegments } from 'expo-router';
import { Text, View, Image } from 'react-native';
import { useEffect } from 'react';
import { seedSpeciesIfNeeded } from '../src/database/seeds/seedSpecies';
import { seedPlantationIfNeeded } from '../src/database/seeds/seedPlantation';
import { seedPlantationSpeciesIfNeeded } from '../src/database/seeds/seedPlantationSpecies';
import { fonts } from '../src/theme';
import { rootLayoutStyles as styles } from '../src/styles/rootLayout.styles';
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
import { PhotoCropProvider } from '../src/components/PhotoCropProvider';
import BannerEntornoPruebas from '../src/components/BannerEntornoPruebas';
import * as SplashScreen from 'expo-splash-screen';

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

  useEffect(() => {
    if (fontsLoaded && success) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, success]);

  useEffect(() => {
    if (success) {
      seedSpeciesIfNeeded()
        .then(() => seedPlantationIfNeeded())
        .then(() => seedPlantationSpeciesIfNeeded())
        .catch(console.error);
    }
  }, [success]);

  // En useEffect porque el router necesita el layout ya montado para navegar.
  useEffect(() => {
    if (!success || loading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inTecnicoGroup = segments[0] === '(tecnico)';

    if (!session || !role) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (esRolAdmin(role)) {
      if (!inAdminGroup) {
        router.replace('/(admin)/plantaciones');
      }
    } else {
      if (!inTecnicoGroup) {
        router.replace('/(tecnico)/plantaciones');
      }
    }
  }, [success, loading, session, role, segments, fontsLoaded]);

  // Error de migración: sin recuperación posible.
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.errorTitle, { fontFamily: fonts.bold }]}>Error de base de datos</Text>
        <Text style={[styles.errorBody, { fontFamily: fonts.regular }]}>Contactar soporte</Text>
        <Text style={[styles.errorDetail, { fontFamily: fonts.light }]}>{error.message}</Text>
      </View>
    );
  }

  if (!success || !fontsLoaded) {
    return null; // splash screen still covers the UI
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../assets/icon-bayka.png')} style={styles.loadingLogo} accessibilityLabel="Bayka" />
        <Text style={[styles.loadingText, { fontFamily: fonts.regular }]}>Iniciando sesión...</Text>
      </View>
    );
  }

  // Always render Slot — navigation happens via router.replace in useEffect
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BannerEntornoPruebas />
      <PhotoCropProvider>
        <Slot />
      </PhotoCropProvider>
    </SafeAreaProvider>
  );
}
