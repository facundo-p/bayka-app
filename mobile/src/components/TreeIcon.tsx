import { Text } from 'react-native';

interface Props {
  size?: number;
}

/**
 * Centralized tree icon for inline use (cards, headers, badges).
 * Change here to update everywhere.
 */
export default function TreeIcon({ size = 14 }: Props) {
  return <Text style={{ fontSize: size }}>🌳</Text>;
}
