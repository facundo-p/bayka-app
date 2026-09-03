import { Stack } from 'expo-router';

// Header nativo oculto: cada pantalla renderiza su propio header unificado
// (CustomHeader + HeaderActionButton + back centralizado, #70).
export default function PlantationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="parcelas" />
      {/* nuevo-grupo es un modal full-screen (EntityFormModal): sin animación
          de stack, para que solo se vea el slide del modal (#89). */}
      <Stack.Screen name="nuevo-grupo" options={{ animation: 'none' }} />
      <Stack.Screen name="subgroup" />
      <Stack.Screen name="catalog" />
    </Stack>
  );
}
