import { useEffect, useState } from 'react';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { db, sqlite } from '../database/client';
import { activarIntegridadReferencial } from '../database/integridadReferencial';

/** Migraciones y después FKs: la app no usa la base hasta que las dos terminan. */
export function useBaseLocal(): { success: boolean; error?: Error } {
  const { success, error } = useMigrations(db, migrations);
  const [fksListas, setFksListas] = useState(false);

  useEffect(() => {
    if (!success) return;
    activarIntegridadReferencial(sqlite);
    setFksListas(true);
  }, [success]);

  return { success: success && fksListas, error };
}
