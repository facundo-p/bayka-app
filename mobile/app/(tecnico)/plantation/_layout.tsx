import { Stack } from 'expo-router';

// Header nativo oculto: cada pantalla del stack renderiza el header unificado
// (CustomHeader verde + HeaderActionButton + flecha de back centralizada). Issue #70.
export default function PlantationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="parcelas" />
      <Stack.Screen name="nuevo-grupo" />
      <Stack.Screen name="subgroup" />
      <Stack.Screen name="catalog" />
    </Stack>
  );
}
