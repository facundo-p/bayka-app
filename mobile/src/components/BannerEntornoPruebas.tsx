/**
 * Franja "ENTORNO DE PRUEBAS · vX.Y.Z · commit" (#287, #321). Se monta una sola
 * vez en app/_layout.tsx, arriba del navigator, y ocupa el inset superior: por
 * eso CustomHeader no lo suma cuando ES_ENTORNO_DE_PRUEBAS. Los modales
 * full-screen la tapan y siguen aplicando su propio inset. En producción no
 * renderiza nada.
 */
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ES_ENTORNO_DE_PRUEBAS, ETIQUETA_BUILD } from '../config/entorno';
import { bannerEntornoPruebasStyles as styles } from './BannerEntornoPruebas.styles';

export default function BannerEntornoPruebas() {
  const insets = useSafeAreaInsets();
  if (!ES_ENTORNO_DE_PRUEBAS) return null;

  return (
    <View testID="banner-entorno-pruebas" pointerEvents="none" style={[styles.franja, { paddingTop: insets.top }]}>
      <Text style={styles.texto} numberOfLines={1}>{`ENTORNO DE PRUEBAS · ${ETIQUETA_BUILD}`}</Text>
    </View>
  );
}
