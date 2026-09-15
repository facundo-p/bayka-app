import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import { useInsetSuperior } from '../hooks/useInsetSuperior';
import { OCUPANTE_DEL_INSET } from './insetSuperior';
import { customHeaderStyles as styles } from './CustomHeader.styles';

interface Props {
  title: string;
  subtitle?: string;
  /** Si se omite, no se muestra la flecha de "atrás" (header raíz, p. ej.
   *  Plantaciones). Si se pasa, la flecha navega con este callback. */
  onBack?: () => void;
  rightElement?: React.ReactNode;
  /** Color de fondo del header. Por defecto el azul de marca (`colors.headerBg`). */
  backgroundColor?: string;
}

export default function CustomHeader({ title, subtitle, onBack, rightElement, backgroundColor = colors.headerBg }: Props) {
  // 0 cuando hay una franja arriba que ya ocupó el inset: la de entorno en la app
  // TEST (#287) o el aviso de OTA (#446).
  const insetTop = useInsetSuperior(OCUPANTE_DEL_INSET.header);

  return (
    <View style={[styles.headerBar, { backgroundColor, paddingTop: insetTop + spacing.sm }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerBackButton} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.headerRight}>
        {rightElement ?? <View style={styles.headerSpacer} />}
      </View>
    </View>
  );
}
