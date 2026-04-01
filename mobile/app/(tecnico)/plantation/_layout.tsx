import { Stack } from 'expo-router';
import { headerStyle } from '../../../src/theme';

export default function PlantationLayout() {
  return (
    <Stack screenOptions={headerStyle}>
      <Stack.Screen name="[id]" options={{ title: 'Subgrupos' }} />
      <Stack.Screen name="nuevo-subgrupo" options={{ title: 'Nuevo subgrupo' }} />
      <Stack.Screen name="subgroup" options={{ headerShown: false }} />
      <Stack.Screen name="catalog" options={{ title: 'Catalogo de plantaciones' }} />
    </Stack>
  );
}
