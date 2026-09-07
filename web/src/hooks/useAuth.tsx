import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  // Último usuario resuelto: distingue un cambio de cuenta de un simple refresh
  // de token, que llega por el mismo callback y no debe tirar la cache.
  const usuarioResuelto = useRef<string | null>(null);

  const resolverSesion = useCallback(
    async (session: Session | null) => {
      const userId = session?.user.id ?? null;
      // Cambió el dueño de la sesión (login, logout, otra cuenta): lo cacheado
      // es del usuario anterior y la RLS del nuevo puede no habilitarlo.
      if (userId !== usuarioResuelto.current) {
        usuarioResuelto.current = userId;
        queryClient.clear();
      }
      if (!session) {
        setPerfil(null);
        setEstado('anonimo');
        return;
      }
      const perfilCargado = await cargarPerfil(session.user.id);
      setPerfil(perfilCargado);
      // Sin acceso: sin perfil, técnico, o cuenta dada de baja (activo=false).
      const tieneAcceso =
        perfilCargado !== null && perfilCargado.rol !== ROL.TECNICO && perfilCargado.activo;
      setEstado(tieneAcceso ? 'autenticado' : 'sin-acceso');
    },
    [queryClient],
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => resolverSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      // setTimeout: el SDK sostiene un lock durante el callback; consultar profiles sincrónicamente adentro puede generar deadlock.
      setTimeout(() => void resolverSesion(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [resolverSesion]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mensajeDeSignIn(error) : null };
  }, []);

  // Resuelve la sesión vacía en vez de setear el estado a mano: así el cierre
  // pasa por el mismo camino que los eventos de auth y descarta la cache
  // aunque el signOut remoto falle. El SIGNED_OUT que llegue después no repite
  // el trabajo.
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await resolverSesion(null);
  }, [resolverSesion]);

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
