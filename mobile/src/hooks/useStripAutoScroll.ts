import { useCallback, useEffect, useRef } from 'react';
import type { FlatList } from 'react-native';

/**
 * Lleva la tira al final cuando la selección cambia sin un toque: un alta o
 * borrar el seleccionado la pasan al último árbol. Un toque no la desplaza,
 * porque el chip tocado ya está a la vista.
 */
export function useStripAutoScroll<T>(selectedId: string | null, onSelect: (id: string) => void) {
  const listRef = useRef<FlatList<T>>(null);
  const tappedIdRef = useRef<string | null>(null);
  const contentWidthRef = useRef(0);

  useEffect(() => {
    if (selectedId !== null && selectedId !== tappedIdRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
    tappedIdRef.current = null;
  }, [selectedId]);

  // El chip del alta se mide después del cambio de selección: al crecer se vuelve a bajar.
  const onContentSizeChange = useCallback((width: number) => {
    const isFirstLayout = contentWidthRef.current === 0;
    const grew = width > contentWidthRef.current;
    contentWidthRef.current = width;
    if (grew) listRef.current?.scrollToEnd({ animated: !isFirstLayout });
  }, []);

  const onChipPress = useCallback((id: string) => {
    tappedIdRef.current = id;
    onSelect(id);
  }, [onSelect]);

  return { listRef, onChipPress, onContentSizeChange };
}
