import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

/** Rutas sin router: permite testearlas con MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/plantaciones" replace />} />
        <Route path="/plantaciones" element={<PlaceholderScreen title="Plantaciones" />} />
        <Route path="/usuarios" element={<PlaceholderScreen title="Usuarios" />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
