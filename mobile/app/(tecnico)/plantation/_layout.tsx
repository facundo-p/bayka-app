import { Stack } from 'expo-router';
import { plantationHeaderStyle } from '../../../src/theme';

export default function PlantationLayout() {
  return (
    <Stack screenOptions={plantationHeaderStyle}>
      <Stack.Screen name="[id]" options={{ title: 'Grupos' }} />
      <Stack.Screen name="parcelas" options={{ title: 'Parcelas' }} />
      <Stack.Screen name="nuevo-grupo" options={{ title: 'Nuevo grupo' }} />
      <Stack.Screen name="subgroup" options={{ headerShown: false }} />
      <Stack.Screen name="catalog" options={{ title: 'Catalogo de plantaciones' }} />
    </Stack>
  );
}
