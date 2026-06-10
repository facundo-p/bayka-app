import { Stack } from 'expo-router';

// Header nativo oculto: cada pantalla del stack renderiza el header unificado
// (CustomHeader verde + HeaderActionButton + flecha de back centralizada). Issue #70.
export default function PlantationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="parcelas" />
      {/* nuevo-grupo se presenta como modal full-screen (EntityFormModal): sin
          animación de stack para que solo se vea el slide del modal (#89). */}
      <Stack.Screen name="nuevo-grupo" options={{ animation: 'none' }} />
      <Stack.Screen name="subgroup" />
      <Stack.Screen name="catalog" />
    </Stack>
  );
}
