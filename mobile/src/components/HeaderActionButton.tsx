/**
 * HeaderActionButton — botón de acción del header (lado derecho) con el criterio
 * único "Outline puro" sobre la barra verde: círculo transparente, borde blanco
 * 1.5px, icono blanco 22. Todos los botones de acción del header (nueva
 * plantación/parcela/grupo, sync, catálogo) DEBEN usar este componente.
 * Tokens en theme.ts.
 *
 * `variant`:
 *  - 'default' → borde + icono blancos
 *  - 'pending' → borde naranja (syncPending) sobre el outline base; icono blanco
 *  - 'offline' → borde + icono en color offline (gris); usar con disabled
 */
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, headerActionButton } from '../theme';
import { headerActionButtonStyles as styles } from './HeaderActionButton.styles';

type Variant = 'default' | 'pending' | 'offline';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  disabled?: boolean;
  testID?: string;
};

export default function HeaderActionButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  disabled = false,
  testID,
}: Props) {
  const iconColor = variant === 'offline' ? colors.offline : colors.white;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={headerActionButton.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        variant === 'pending' && styles.borderPending,
        variant === 'offline' && styles.borderOffline,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={headerActionButton.iconSize} color={iconColor} />
    </Pressable>
  );
}
