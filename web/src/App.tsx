import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RequireAccess } from './components/RequireAccess';
import { AuthProvider } from './hooks/useAuth';
import { LoginScreen } from './screens/LoginScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

/** Rutas sin router: permite testearlas con MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route element={<RequireAccess />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/plantaciones" replace />} />
          <Route path="/plantaciones" element={<PlaceholderScreen title="Plantaciones" />} />
          <Route path="/usuarios" element={<PlaceholderScreen title="Usuarios" />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
