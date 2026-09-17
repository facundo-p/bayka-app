/**
 * Franja "ENTORNO DE PRUEBAS · vX.Y.Z · commit" (#287, #321). La monta
 * `FranjasSuperiores` una sola vez, arriba de todo, y es la primera de la pila:
 * cuando está, ocupa el inset superior y los de abajo no lo suman. Los modales
 * full-screen la tapan y siguen aplicando su propio inset. En producción no
 * renderiza nada.
 */
import { View, Text } from 'react-native';
import { ES_ENTORNO_DE_PRUEBAS, ETIQUETA_BUILD } from '../config/entorno';
import { useInsetSuperior } from '../hooks/useInsetSuperior';
import { OCUPANTE_DEL_INSET } from './insetSuperior';
import { bannerEntornoPruebasStyles as styles } from './BannerEntornoPruebas.styles';

const TEXTO_BANNER_ENTORNO = 'ENTORNO DE PRUEBAS';

export default function BannerEntornoPruebas() {
  const insetTop = useInsetSuperior(OCUPANTE_DEL_INSET.entorno);
  if (!ES_ENTORNO_DE_PRUEBAS) return null;

  return (
    <View testID="banner-entorno-pruebas" pointerEvents="none" style={[styles.franja, { paddingTop: insetTop }]}>
      <Text style={styles.texto} numberOfLines={1}>{`${TEXTO_BANNER_ENTORNO} · ${ETIQUETA_BUILD}`}</Text>
    </View>
  );
}
