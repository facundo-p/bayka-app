import { Tabs } from 'expo-router';

export default function TecnicoLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2d6a2d',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="plantaciones"
        options={{ title: 'Plantaciones' }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil' }}
      />
    </Tabs>
  );
}
