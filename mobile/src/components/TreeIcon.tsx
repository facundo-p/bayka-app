import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';

interface Props {
  size?: number;
  color?: string;
}

/**
 * Centralized tree icon for inline use (cards, headers, badges).
 * Change here to update everywhere.
 */
export default function TreeIcon({ size = 14, color = colors.plantation }: Props) {
  return <MaterialCommunityIcons name="tree" size={size} color={color} />;
}
