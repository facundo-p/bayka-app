import 'react-native-url-polyfill/auto'; // MUST be first import

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../src/database/client';
import { Slot } from 'expo-router';
import { Text, View } from 'react-native';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error de base de datos. Contactar soporte.</Text>
        <Text style={{ color: 'red', marginTop: 8 }}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Inicializando...</Text>
      </View>
    );
  }

  // Auth guard added in Plan 01-03 — placeholder for now
  return <Slot />;
}
