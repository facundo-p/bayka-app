import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

/**
 * "Atrás" jerárquico unificado para las pantallas del stack `plantation`.
 *
 * El header y el back del SO (hardware/gesto) van al MISMO destino explícito: el
 * padre lógico de la pantalla (Parcelas→Plantaciones, Grupos→Parcelas, …), sin
 * depender del orden del stack. Hace falta porque el stack acumula pantallas
 * (p.ej. `catalog` queda colgado al volver al tab, que preserva su estado): un
 * pop del SO caía en la pantalla equivocada (#85).
 *
 * Devuelve el handler para el header e intercepta el back de hardware mientras
 * la pantalla está enfocada (`useFocusEffect`, así no se pisan entre pantallas).
 */
export function useScreenBack(target: string) {
  const router = useRouter();
  const goBack = useCallback(() => {
    router.navigate(target as never);
  }, [router, target]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack]),
  );

  return goBack;
}
