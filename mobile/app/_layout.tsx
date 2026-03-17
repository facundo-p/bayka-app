import 'react-native-url-polyfill/auto'; // MUST be first import

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../src/database/client';
import { useAuth } from '../src/hooks/useAuth';
import { Redirect, Stack } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { seedSpeciesIfNeeded } from '../src/database/seeds/seedSpecies';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const { session, role, loading } = useAuth();

  // Run species seed after migrations succeed
  useEffect(() => {
    if (success) {
      seedSpeciesIfNeeded().catch(console.error);
    }
  }, [success]);

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

  // Auth loading (session restore in progress)
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Iniciando sesión...</Text>
      </View>
    );
  }

  // Not logged in → login screen
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Logged in → route by role
  if (role === 'admin') {
    return <Redirect href="/(admin)/plantaciones" />;
  }
  return <Redirect href="/(tecnico)/plantaciones" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c00',
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  errorDetail: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
