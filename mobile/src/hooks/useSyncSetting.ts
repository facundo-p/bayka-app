import * as SecureStore from 'expo-secure-store';
import { useState, useEffect, useCallback } from 'react';

const SYNC_PHOTOS_KEY = 'sync_include_photos';

export function useSyncSetting() {
  const [incluirFotos, setIncluirFotos] = useState(true); // default = include photos

  useEffect(() => {
    SecureStore.getItemAsync(SYNC_PHOTOS_KEY).then(val => {
      if (val !== null) setIncluirFotos(val === 'true');
    });
  }, []);

  const toggleIncluirFotos = useCallback(async (value: boolean) => {
    setIncluirFotos(value);
    await SecureStore.setItemAsync(SYNC_PHOTOS_KEY, String(value));
  }, []);

  return { incluirFotos, toggleIncluirFotos };
}
