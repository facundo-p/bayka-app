import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ES_ENTORNO_DE_PRUEBAS } from '../config/entorno';
import {
  InsetSuperiorContexto,
  OCUPANTE_DEL_INSET,
  ocupanteDelInsetSuperior,
  type OcupanteDelInset,
} from '../components/insetSuperior';

/**
 * El inset de la status bar que le toca aplicar a este elemento: el alto real si
 * es el primero de la pila superior, 0 si alguien arriba ya lo ocupó.
 */
export function useInsetSuperior(elemento: OcupanteDelInset): number {
  const insets = useSafeAreaInsets();
  const { hayAvisoDeActualizacion } = useContext(InsetSuperiorContexto);
  // El aviso solo se monta cuando existe, así que desde adentro no necesita
  // preguntarlo: el contexto está para los que van abajo y no pueden verlo.
  const hayAviso = hayAvisoDeActualizacion || elemento === OCUPANTE_DEL_INSET.aviso;
  const ocupante = ocupanteDelInsetSuperior(ES_ENTORNO_DE_PRUEBAS, hayAviso);

  return ocupante === elemento ? insets.top : 0;
}
