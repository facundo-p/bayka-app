import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface Props {
  color: string;
  size: number;
}

/**
 * Centralized "Plantaciones" tab icon.
 * Change here to update in both admin and tecnico tab bars.
 */
export default function PlantacionesTabIcon({ color, size }: Props) {
  return <MaterialCommunityIcons name="tree-outline" size={size} color={color} />;
}
