import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getPerfil, ROL, type Perfil } from '../repositories/profileRepository';

export type EstadoAuth = 'cargando' | 'anonimo' | 'sin-acceso' | 'autenticado';

export type AuthContextValue = {
  estado: EstadoAuth;
  perfil: Perfil | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const MENSAJE_CREDENCIALES = 'Credenciales inválidas';
const MENSAJE_SIGNIN_GENERICO = 'No se pudo iniciar sesión. Probá de nuevo en unos minutos.';

function mensajeDeSignIn(error: AuthError): string {
  return error.message.includes('Invalid login credentials')
    ? MENSAJE_CREDENCIALES
    : MENSAJE_SIGNIN_GENERICO;
}

/** Tolera errores de red: un perfil ilegible se trata como inexistente (sin acceso). */
async function cargarPerfil(userId: string): Promise<Perfil | null> {
  try {
    return await getPerfil(userId);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>('cargando');
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const resolverSesion = useCallback(async (session: Session | null) => {
    if (!session) {
      setPerfil(null);
      setEstado('anonimo');
      return;
    }
    const perfilCargado = await cargarPerfil(session.user.id);
    setPerfil(perfilCargado);
    setEstado(perfilCargado && perfilCargado.rol !== ROL.TECNICO ? 'autenticado' : 'sin-acceso');
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => resolverSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      // setTimeout: el SDK sostiene un lock mientras corre este callback;
      // consultar profiles adentro en forma sincrónica puede generar deadlock.
      setTimeout(() => void resolverSesion(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [resolverSesion]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mensajeDeSignIn(error) : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
    setEstado('anonimo');
  }, []);

  return (
    <AuthContext.Provider value={{ estado, perfil, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return contexto;
}
