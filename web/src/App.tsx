import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/AppLayout';
import { BannerEntornoPruebas } from './components/BannerEntornoPruebas';
import { RequireAccess, RequireSuperadmin } from './components/RequireAccess';
import { AuthProvider } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import { PATRON_DETALLE_PLANTACION, RUTA, SEGMENTO_DATOS, TAB_DETALLE } from './lib/rutas';
import { LoginScreen } from './screens/LoginScreen';
import { EstablecerPasswordScreen } from './screens/EstablecerPasswordScreen';
import { EspeciesScreen } from './screens/EspeciesScreen';
import { NovedadesScreen } from './screens/NovedadesScreen';
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
      <Route path={RUTA.login} element={<LoginScreen />} />
      {/* Destino del link de invitación: pública, un técnico también la usa. */}
      <Route path={RUTA.establecerPassword} element={<EstablecerPasswordScreen />} />
      <Route element={<RequireAccess />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to={RUTA.plantaciones} replace />} />
          <Route path={RUTA.plantaciones} element={<PlantacionesScreen />} />
          <Route path={PATRON_DETALLE_PLANTACION} element={<PlantacionDetailScreen />}>
            <Route index element={<DashboardTab />} />
            <Route path={TAB_DETALLE.datos} element={<DatosTab />}>
              <Route index element={<Navigate to={SEGMENTO_DATOS.parcelas} replace />} />
              <Route path={SEGMENTO_DATOS.parcelas} element={<ParcelasSection />} />
              <Route path={SEGMENTO_DATOS.grupos} element={<GruposSection />} />
              <Route path={SEGMENTO_DATOS.arboles} element={<ArbolesSection />} />
            </Route>
            <Route path={TAB_DETALLE.configuracion} element={<ConfiguracionTab />} />
          </Route>
          <Route path={RUTA.especies} element={<EspeciesScreen />} />
          <Route path={RUTA.novedades} element={<NovedadesScreen />} />
          <Route element={<RequireSuperadmin />}>
            <Route path={RUTA.usuarios} element={<UsuariosScreen />} />
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
          <BannerEntornoPruebas />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
