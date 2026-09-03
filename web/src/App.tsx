import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/AppLayout';
import { BannerEntornoPruebas } from './components/BannerEntornoPruebas';
import { RequireAccess, RequireSuperadmin } from './components/RequireAccess';
import { AuthProvider } from './hooks/useAuth';
import { CommandMenuProvider } from './hooks/useCommandMenu';
import { queryClient } from './lib/queryClient';
import { LoginScreen } from './screens/LoginScreen';
import { EstablecerPasswordScreen } from './screens/EstablecerPasswordScreen';
import { EspeciesScreen } from './screens/EspeciesScreen';
import { PlantacionDetailScreen } from './screens/PlantacionDetailScreen';
import { PlantacionesScreen } from './screens/PlantacionesScreen';
import { UsuariosScreen } from './screens/UsuariosScreen';
import { ConfiguracionTab } from './screens/configuracion/ConfiguracionTab';
import { DashboardTab } from './screens/dashboard/DashboardTab';
import { ArbolesSection } from './screens/datos/ArbolesSection';
import { DatosTab } from './screens/datos/DatosTab';
import { GruposSection } from './screens/datos/GruposSection';
import { ParcelasSection } from './screens/datos/ParcelasSection';

/** Rutas sin router: permite testearlas con MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      {/* Destino del link de invitación: pública, un técnico también la usa. */}
      <Route path="/establecer-password" element={<EstablecerPasswordScreen />} />
      <Route element={<RequireAccess />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/plantaciones" replace />} />
          <Route path="/plantaciones" element={<PlantacionesScreen />} />
          <Route path="/plantaciones/:id" element={<PlantacionDetailScreen />}>
            <Route index element={<DashboardTab />} />
            <Route path="datos" element={<DatosTab />}>
              <Route index element={<Navigate to="parcelas" replace />} />
              <Route path="parcelas" element={<ParcelasSection />} />
              <Route path="grupos" element={<GruposSection />} />
              <Route path="arboles" element={<ArbolesSection />} />
            </Route>
            <Route path="configuracion" element={<ConfiguracionTab />} />
          </Route>
          <Route path="/especies" element={<EspeciesScreen />} />
          <Route element={<RequireSuperadmin />}>
            <Route path="/usuarios" element={<UsuariosScreen />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CommandMenuProvider>
            <BannerEntornoPruebas />
            <AppRoutes />
          </CommandMenuProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
