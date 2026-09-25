// Tests for useAuth hook

import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { setOffline, setOnline, setSinInternet, setRedDesconocida, SIN_INTERNET } from '../helpers/networkHelper';

jest.mock('expo-secure-store');

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      startAutoRefresh: jest.fn().mockResolvedValue(undefined),
      stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/supabase/auth', () => ({
  persistSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
  readCachedSession: jest.fn().mockResolvedValue(null),
  readSesionCacheada: jest.fn().mockResolvedValue(null),
  readCachedUserId: jest.fn().mockResolvedValue('user-1'),
  iniciarSesionSoloLocal: jest.fn().mockResolvedValue({ soloLocal: true }),
  SESION_SOLO_LOCAL_KEY: 'sesion_solo_local',
  ACCESS_TOKEN_KEY: 'access_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  ROLE_KEY: 'user_role',
  EMAIL_KEY: 'user_email',
  USER_ID_KEY: 'user_id',
}));

jest.mock('../../src/services/OfflineAuthService', () => ({
  cacheCredential: jest.fn().mockResolvedValue(undefined),
  verifyCredential: jest.fn(),
  esCredencialSinUsuario: jest.requireActual('../../src/services/OfflineAuthService').esCredencialSinUsuario,
  saveLastOnlineLogin: jest.fn().mockResolvedValue(undefined),
  isOfflineLoginExpired: jest.fn().mockResolvedValue(false),
  clearCredential: jest.fn().mockResolvedValue(undefined),
  clearAllCredentials: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/hooks/useCurrentUserId', () => ({
  USER_ID_KEY: 'user_id',
}));

const { supabase } = require('../../src/supabase/client');
const { readCachedSession, readSesionCacheada, readCachedUserId } = require('../../src/supabase/auth');
const { verifyCredential, isOfflineLoginExpired } = require('../../src/services/OfflineAuthService');

import { renderHook, act } from '@testing-library/react-native';
import { useAuth, __resetRevalidacionDeArranque } from '../../src/hooks/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetRevalidacionDeArranque();
    setOnline();

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    (supabase.auth.startAutoRefresh as jest.Mock).mockResolvedValue(undefined);
    (supabase.auth.stopAutoRefresh as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (readCachedSession as jest.Mock).mockResolvedValue(null);
    (readSesionCacheada as jest.Mock).mockResolvedValue(null);
    (readCachedUserId as jest.Mock).mockResolvedValue('user-1');
    (isOfflineLoginExpired as jest.Mock).mockResolvedValue(false);

    // AsyncStorage.getAllKeys must return an array for signOut
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
  });

  describe('signIn online', () => {
    it('calls supabase.auth.signInWithPassword when online with valid credentials', async () => {
      const mockSession = { access_token: 'token-abc', refresh_token: 'refresh-abc', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico' }, error: null }),
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password',
      });
      expect(signInResult.error).toBeNull();
    });

    it('caches credentials after successful online sign in', async () => {
      const mockSession = { access_token: 'token-abc', refresh_token: 'refresh-abc', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico' }, error: null }),
      });

      const { cacheCredential } = require('../../src/services/OfflineAuthService');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn('test@test.com', 'password');
      });

      expect(cacheCredential).toHaveBeenCalledWith('test@test.com', 'password', expect.any(String), 'user-1');
    });
  });

  describe('signIn online — backend down / errors (issue #64)', () => {
    it('never surfaces the raw parse error when backend is down and no cached creds', async () => {
      // Online, but backend returns a non-JSON error WITHOUT throwing.
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'JSON Parse error: Unexpected character e' },
      });
      (verifyCredential as jest.Mock).mockResolvedValue(null); // no cached creds

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error).not.toBeNull();
      expect(signInResult.error.message).not.toContain('JSON Parse');
      expect(signInResult.error.message).toContain('No se pudo conectar');
      expect(signInResult.data.session).toBeNull();
    });

    it('falls back to offline login when backend is down but creds are cached', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'JSON Parse error: Unexpected character e' },
      });
      (verifyCredential as jest.Mock).mockResolvedValue({ role: 'tecnico', userId: 'user-1' });
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error).toBeNull();
      expect(signInResult.data.session).toBeTruthy();
    });

    it('shows the credentials message (not raw) for real invalid credentials', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'wrong');
      });

      expect(signInResult.error.message).toBe('Email o contraseña incorrectos.');
      // Must NOT trigger the offline fallback for a real credential error.
      expect(verifyCredential).not.toHaveBeenCalled();
    });
  });

  describe('signIn offline fallback', () => {
    it('calls verifyCredential when offline (NetInfo reports not connected)', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue({ role: 'tecnico', userId: 'user-1' });
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(verifyCredential).toHaveBeenCalledWith('test@test.com', 'password');
      expect(signInResult.error).toBeNull();
      expect(signInResult.data.session).toBeTruthy();
    });

    it('returns error when offline and credentials not cached', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue(null); // no cached credentials

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'wrong-password');
      });

      expect(signInResult.error).not.toBeNull();
      expect(signInResult.data.session).toBeNull();
    });

    it('returns error when offline login is expired', async () => {
      setOffline();
      (isOfflineLoginExpired as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error).not.toBeNull();
      expect(signInResult.error.message).toContain('expirada');
    });
  });

  describe('signOut', () => {
    it('clears ROLE_KEY from SecureStore on sign out', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_role');
    });

    it('sets session to null after sign out', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe('role', () => {
    it('reads role from SecureStore cache when available during init', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { rol: 'admin' }, error: null }),
          }),
        }),
      });

      const mockSession = { access_token: 'token', refresh_token: 'refresh', user: { id: 'u-1', email: 'a@a.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.role).toBe('admin');
    });

    it('un superadmin obtiene su rol y se cachea (opera como admin en campo)', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { rol: 'superadmin', activo: true }, error: null }),
          }),
        }),
      });
      const mockSession = { access_token: 'token', refresh_token: 'refresh', user: { id: 'u-1', email: 'a@a.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.role).toBe('superadmin');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('user_role', 'superadmin');
    });
  });

  describe('cuenta desactivada (baja reversible desde la web)', () => {
    function mockPerfilDesactivado() {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico', activo: false }, error: null }),
          }),
        }),
      });
    }

    it('en el init online con sesión, desloguea y no restaura rol', async () => {
      mockPerfilDesactivado();
      const mockSession = { access_token: 'token', refresh_token: 'refresh', user: { id: 'u-1', email: 'a@a.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.session).toBeNull();
      expect(result.current.role).toBeNull();
      // Purga total: rol, tokens y credenciales offline (sin esto, re-entraría offline).
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_role');
      const { clearSession } = require('../../src/supabase/auth');
      const { clearAllCredentials } = require('../../src/services/OfflineAuthService');
      expect(clearSession).toHaveBeenCalled();
      expect(clearAllCredentials).toHaveBeenCalled();
    });

    it('en el signIn online devuelve el mensaje de cuenta desactivada y no cachea credenciales', async () => {
      mockPerfilDesactivado();
      const mockSession = { access_token: 'token-abc', refresh_token: 'refresh-abc', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      const { cacheCredential } = require('../../src/services/OfflineAuthService');

      const { result } = renderHook(() => useAuth());
      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error.message).toContain('desactivada');
      expect(signInResult.data.session).toBeNull();
      expect(cacheCredential).not.toHaveBeenCalled();
    });

    it('offline NO consulta el estado: restaura la sesión cacheada (contrato intacto)', async () => {
      setOffline();
      (readSesionCacheada as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tecnico');

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.session).not.toBeNull();
      expect(result.current.role).toBe('tecnico');
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('cross-instance broadcast', () => {
    it('signIn on one instance updates session/role on another instance', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue({ role: 'tecnico', userId: 'user-1' });
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      // Two hook instances simulate two components sharing auth state.
      const { result: instance1 } = renderHook(() => useAuth());
      const { result: instance2 } = renderHook(() => useAuth());

      expect(instance1.current.session).toBeNull();
      expect(instance2.current.session).toBeNull();

      await act(async () => {
        await instance1.current.signIn('test@test.com', 'password');
      });

      // Wait for broadcast propagation.
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(instance2.current.session).not.toBeNull();
      expect(instance2.current.role).toBe('tecnico');
    });

    it('signOut on one instance clears session on another instance', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue({ role: 'tecnico', userId: 'user-1' });
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      const { result: instance1 } = renderHook(() => useAuth());
      const { result: instance2 } = renderHook(() => useAuth());

      await act(async () => {
        await instance1.current.signIn('test@test.com', 'password');
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(instance2.current.session).not.toBeNull();

      await act(async () => {
        await instance1.current.signOut();
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(instance2.current.session).toBeNull();
      expect(instance2.current.role).toBeNull();
    });
  });

  describe('criterio de conexión (#652)', () => {
    const SESION_SDK = { access_token: 't', refresh_token: 'r', user: { id: 'user-1', email: 'a@a.com' } };

    function perfil(datos: object) {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: datos, error: null }),
      });
    }

    function diferido<T>() {
      let resolver!: (v: T) => void;
      const promesa = new Promise<T>((r) => { resolver = r; });
      return { promesa, resolver };
    }

    const escribio = (clave: string, valor: string) =>
      (SecureStore.setItemAsync as jest.Mock).mock.calls.some(([k, v]) => k === clave && v === valor);

    async function montarYEsperarInit() {
      const hook = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      return hook;
    }

    function mockLoginOnlineOk() {
      const mockSession = { access_token: 't', refresh_token: 'r', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { session: mockSession }, error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico', activo: true }, error: null }),
      });
    }

    function ultimoListenerDeRed(): (estado: object) => Promise<void> {
      const calls = (NetInfo.addEventListener as jest.Mock).mock.calls;
      return calls[calls.length - 1][0];
    }

    function ultimoListenerDeAuth(): (event: string, session: unknown) => Promise<void> {
      const calls = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls;
      return calls[calls.length - 1][0];
    }

    async function loguear(result: { current: ReturnType<typeof useAuth> }, password = 'password') {
      let res: any;
      await act(async () => { res = await result.current.signIn('test@test.com', password); });
      return res;
    }

    describe('conectado sin internet confirmado (Android validando la red o con señal débil)', () => {
      it('con credencial válida entra offline al instante, sin tocar el servidor', async () => {
        setSinInternet();
        (verifyCredential as jest.Mock).mockResolvedValue({ role: 'tecnico', userId: 'user-1' });
        const { result } = await montarYEsperarInit();

        const res = await loguear(result);

        expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
        expect(res.error).toBeNull();
      });

      it('sin credencial cacheada intenta online y entra', async () => {
        setSinInternet();
        (verifyCredential as jest.Mock).mockResolvedValue(null);
        mockLoginOnlineOk();
        const { result } = await montarYEsperarInit();

        const res = await loguear(result);

        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(res.error).toBeNull();
        expect(res.data.session).toBeTruthy();
      });

      it('sin credencial cacheada y el servidor no responde: al timeout avisa de conectividad', async () => {
        setSinInternet();
        (verifyCredential as jest.Mock).mockResolvedValue(null);
        (supabase.auth.signInWithPassword as jest.Mock).mockReturnValue(new Promise(() => {}));
        const { result } = await montarYEsperarInit();

        jest.useFakeTimers();
        try {
          let res: any;
          await act(async () => {
            const pendiente = result.current.signIn('test@test.com', 'password');
            await jest.advanceTimersByTimeAsync(8000);
            res = await pendiente;
          });
          expect(res.error.message).toBe('No se pudo conectar con el servidor. Verificá tu conexión o intentá más tarde.');
          expect(verifyCredential).toHaveBeenCalledTimes(1);
        } finally {
          jest.useRealTimers();
        }
      });

      it('con el login offline vencido intenta online', async () => {
        setSinInternet();
        (isOfflineLoginExpired as jest.Mock).mockResolvedValue(true);
        mockLoginOnlineOk();
        const { result } = await montarYEsperarInit();

        const res = await loguear(result);

        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(res.error).toBeNull();
      });

      it('contraseña que no coincide con la cacheada: decide el servidor, con su mensaje', async () => {
        setSinInternet();
        (verifyCredential as jest.Mock).mockResolvedValue(null);
        (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
        });
        const { result } = await montarYEsperarInit();

        const res = await loguear(result, 'otra');

        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(res.error.message).toBe('Email o contraseña incorrectos.');
      });
    });

    it('sin red: login offline sin intentar el servidor aunque no haya credencial', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue(null);
      const { result } = await montarYEsperarInit();

      const res = await loguear(result);

      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(res.error).not.toBeNull();
    });

    it('red desconocida: el login intenta online (no bloquea a quien tiene red)', async () => {
      setRedDesconocida();
      mockLoginOnlineOk();
      const { result } = await montarYEsperarInit();

      let res: any;
      await act(async () => { res = await result.current.signIn('test@test.com', 'password'); });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
      expect(res.error).toBeNull();
    });

    it('conectado sin internet: el init no toca supabase y restaura del cache', async () => {
      setSinInternet();
      await montarYEsperarInit();

      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      expect(supabase.auth.startAutoRefresh).not.toHaveBeenCalled();
      expect(readSesionCacheada).toHaveBeenCalled();
    });

    it('red desconocida: el init intenta online', async () => {
      setRedDesconocida();
      await montarYEsperarInit();

      expect(supabase.auth.getSession).toHaveBeenCalled();
    });

    it('internet deja de responder: se para el auto-refresh', async () => {
      await montarYEsperarInit();
      const alCambiarRed = ultimoListenerDeRed();
      await act(async () => { await alCambiarRed({ isConnected: true, isInternetReachable: true }); });
      (supabase.auth.stopAutoRefresh as jest.Mock).mockClear();

      await act(async () => { await alCambiarRed(SIN_INTERNET); });

      expect(supabase.auth.stopAutoRefresh).toHaveBeenCalled();
    });

    describe('arranque sin conexión confirmada', () => {


      async function arrancarSinInternetConSesion() {
        setSinInternet();
        (readSesionCacheada as jest.Mock).mockResolvedValue({ access_token: 'cached', refresh_token: 'cached-r' });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tecnico');
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: SESION_SDK } });
        const hook = await montarYEsperarInit();
        expect(supabase.auth.getSession).not.toHaveBeenCalled();
        return hook;
      }

      async function confirmarConexion() {
        await act(async () => {
          await ultimoListenerDeRed()({ isConnected: true, isInternetReachable: true });
          await new Promise((r) => setTimeout(r, 20));
        });
      }

      it('al confirmarse la conexión revalida una sola vez y refresca el rol', async () => {
        perfil({ rol: 'admin', activo: true });
        const { result } = await arrancarSinInternetConSesion();

        await confirmarConexion();
        await confirmarConexion();

        expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
        expect(result.current.role).toBe('admin');
        expect(result.current.session).toBe(SESION_SDK);
      });

      it('si la cuenta fue desactivada, la purga', async () => {
        perfil({ rol: 'tecnico', activo: false });
        const { result } = await arrancarSinInternetConSesion();

        await confirmarConexion();

        expect(result.current.session).toBeNull();
        const { clearAllCredentials } = require('../../src/services/OfflineAuthService');
        expect(clearAllCredentials).toHaveBeenCalled();
      });

      it('no revalida con una red que sigue sin internet confirmado', async () => {
        await arrancarSinInternetConSesion();

        await act(async () => { await ultimoListenerDeRed()(SIN_INTERNET); });

        expect(supabase.auth.getSession).not.toHaveBeenCalled();
      });

      it('no revive una sesión que se cerró antes de confirmarse la conexión', async () => {
        perfil({ rol: 'tecnico', activo: true });
        const { result } = await arrancarSinInternetConSesion();
        await act(async () => { await result.current.signOut(); });

        await confirmarConexion();

        expect(result.current.session).toBeNull();
        expect(supabase.auth.getSession).not.toHaveBeenCalled();
      });

      it('si la revalidación falla, queda para la próxima confirmación de red (sin reintento inmediato)', async () => {
        perfil({ rol: 'admin', activo: true });
        const { result } = await arrancarSinInternetConSesion();
        (supabase.auth.getSession as jest.Mock)
          .mockRejectedValueOnce(new Error('Network request failed'))
          .mockResolvedValue({ data: { session: SESION_SDK } });

        await confirmarConexion();
        expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
        expect(result.current.role).toBe('tecnico');

        await confirmarConexion();
        expect(supabase.auth.getSession).toHaveBeenCalledTimes(2);
        expect(result.current.role).toBe('admin');
      });

      it('la sesión de otra cuenta en el SDK no se adopta', async () => {
        perfil({ rol: 'admin', activo: true });
        (readCachedUserId as jest.Mock).mockResolvedValue('otra-cuenta');
        const { result } = await arrancarSinInternetConSesion();

        await confirmarConexion();

        expect(result.current.role).toBe('tecnico');
        expect(supabase.from).not.toHaveBeenCalled();
      });

      it('signOut con el rol en camino: no reescribe el rol ni revive la sesión', async () => {
        const rolEnCamino = diferido<{ data: object; error: null }>();
        (supabase.from as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue(rolEnCamino.promesa),
        });
        const { result } = await arrancarSinInternetConSesion();
        await confirmarConexion();
        expect(supabase.from).toHaveBeenCalled();

        await act(async () => { await result.current.signOut(); });
        await act(async () => {
          rolEnCamino.resolver({ data: { rol: 'admin', activo: true }, error: null });
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(escribio('user_role', 'admin')).toBe(false);
        expect(result.current.session).toBeNull();
      });

      it('signOut y login offline de otra cuenta en la ventana: no pisa la cuenta nueva', async () => {
        const sdkEnCamino = diferido<{ data: { session: typeof SESION_SDK } }>();
        perfil({ rol: 'admin', activo: true });
        const { result } = await arrancarSinInternetConSesion();
        (supabase.auth.getSession as jest.Mock).mockReturnValue(sdkEnCamino.promesa);
        await confirmarConexion();

        await act(async () => { await result.current.signOut(); });
        (verifyCredential as jest.Mock).mockResolvedValue({ role: 'tecnico', userId: 'user-2' });
        setOffline();
        await loguear(result);
        (SecureStore.setItemAsync as jest.Mock).mockClear();
        await act(async () => {
          sdkEnCamino.resolver({ data: { session: SESION_SDK } });
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        expect(result.current.session).not.toBe(SESION_SDK);
        expect(result.current.role).toBe('tecnico');
      });

      function rolDiferidoPrimero() {
        const rolEnCamino = diferido<{ data: object; error: null }>();
        const single = jest.fn()
          .mockReturnValueOnce(rolEnCamino.promesa)
          .mockResolvedValue({ data: { rol: 'tecnico', activo: true }, error: null });
        (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single });
        return rolEnCamino;
      }

      async function resolverRol(rolEnCamino: ReturnType<typeof rolDiferidoPrimero>) {
        await act(async () => {
          rolEnCamino.resolver({ data: { rol: 'admin', activo: true }, error: null });
          await new Promise((r) => setTimeout(r, 20));
        });
      }

      it('login online con la revalidación en vuelo: no pisa el rol de la cuenta nueva', async () => {
        const rolEnCamino = rolDiferidoPrimero();
        const { result } = await arrancarSinInternetConSesion();
        await confirmarConexion();
        (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: { access_token: 't2', refresh_token: 'r2', user: { id: 'user-2', email: 'b@b.com' } } },
          error: null,
        });

        setOnline();
        const res = await loguear(result);
        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(res.error).toBeNull();
        expect(escribio('user_role', 'tecnico')).toBe(true);
        (SecureStore.setItemAsync as jest.Mock).mockClear();
        await resolverRol(rolEnCamino);

        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        expect(result.current.role).not.toBe('admin');
        expect(result.current.session).not.toBe(SESION_SDK);
      });

      it('purga por cuenta desactivada con la revalidación en vuelo: la sesión no revive', async () => {
        const rolEnCamino = rolDiferidoPrimero();
        const { result } = await arrancarSinInternetConSesion();
        await confirmarConexion();
        (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: { status: 400, code: 'user_banned', message: 'User is banned' },
        });

        setOnline();
        await loguear(result);
        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(result.current.session).toBeNull();
        (SecureStore.setItemAsync as jest.Mock).mockClear();
        await resolverRol(rolEnCamino);

        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        expect(result.current.session).toBeNull();
      });

      it('SIGNED_OUT confirmado del SDK con la revalidación en vuelo: no reescribe el rol', async () => {
        const rolEnCamino = rolDiferidoPrimero();
        const { result } = await arrancarSinInternetConSesion();
        await confirmarConexion();

        setOnline();
        await act(async () => { await ultimoListenerDeAuth()('SIGNED_OUT', null); });
        (SecureStore.setItemAsync as jest.Mock).mockClear();
        await resolverRol(rolEnCamino);

        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        expect(result.current.session).toBeNull();
      });

      it('con varias instancias, también montadas después, revalida una sola vez y todas reciben el rol', async () => {
        perfil({ rol: 'admin', activo: true });
        setSinInternet();
        (readSesionCacheada as jest.Mock).mockResolvedValue({ access_token: 'cached', refresh_token: 'cached-r' });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tecnico');
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: SESION_SDK } });
        const a = renderHook(() => useAuth());
        const b = renderHook(() => useAuth());
        await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

        await confirmarConexion();
        renderHook(() => useAuth());
        await confirmarConexion();

        expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
        expect(a.result.current.role).toBe('admin');
        expect(b.result.current.role).toBe('admin');
      });

      it('signOut durante un init offline: no arma la revalidación ni revive la sesión', async () => {
        const cacheEnCamino = diferido<object>();
        setSinInternet();
        (readSesionCacheada as jest.Mock).mockReturnValue(cacheEnCamino.promesa);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: SESION_SDK } });
        const { result } = renderHook(() => useAuth());

        await act(async () => { await result.current.signOut(); });
        await act(async () => {
          cacheEnCamino.resolver({ access_token: 'cached', refresh_token: 'cached-r' });
          await new Promise((r) => setTimeout(r, 20));
        });
        await confirmarConexion();

        expect(result.current.session).toBeNull();
        expect(supabase.auth.getSession).not.toHaveBeenCalled();
      });
    });

    describe('arranque online', () => {

      it('signOut con el rol del init en camino, con dos instancias: no reescribe el rol ni revive la sesión', async () => {
        const rolEnCamino = diferido<{ data: object; error: null }>();
        (supabase.from as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue(rolEnCamino.promesa),
        });
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: SESION_SDK } });
        const perfilScreen = renderHook(() => useAuth());
        const otraPantalla = renderHook(() => useAuth());
        await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

        await act(async () => { await perfilScreen.result.current.signOut(); });
        await act(async () => {
          rolEnCamino.resolver({ data: { rol: 'admin', activo: true }, error: null });
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(escribio('user_role', 'admin')).toBe(false);
        expect(perfilScreen.result.current.session).toBeNull();
        expect(otraPantalla.result.current.session).toBeNull();
      });

      it('si el servidor falla en el init, restaura del cache y revalida al confirmarse la conexión', async () => {
        perfil({ rol: 'admin', activo: true });
        (readSesionCacheada as jest.Mock).mockResolvedValue({ access_token: 'cached', refresh_token: 'cached-r' });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tecnico');
        (supabase.auth.getSession as jest.Mock)
          .mockRejectedValueOnce(new Error('Network request failed'))
          .mockResolvedValue({ data: { session: SESION_SDK } });
        const { result } = await montarYEsperarInit();
        expect(result.current.role).toBe('tecnico');

        await act(async () => {
          await ultimoListenerDeRed()({ isConnected: true, isInternetReachable: true });
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(supabase.auth.getSession).toHaveBeenCalledTimes(2);
        expect(result.current.role).toBe('admin');
      });
    });

    describe('handler SIGNED_IN del SDK', () => {
      it('signOut mientras el handler espera el rol: no escribe el rol ni revive la sesión', async () => {
        const rolEnCamino = diferido<{ data: object; error: null }>();
        (supabase.from as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnValue(rolEnCamino.promesa),
        });
        const { result } = await montarYEsperarInit();

        let handler!: Promise<void>;
        await act(async () => {
          handler = ultimoListenerDeAuth()('SIGNED_IN', SESION_SDK);
          await new Promise((r) => setTimeout(r, 10));
        });
        await act(async () => { await result.current.signOut(); });
        await act(async () => {
          rolEnCamino.resolver({ data: { rol: 'admin', activo: true }, error: null });
          await handler;
        });

        expect(escribio('user_role', 'admin')).toBe(false);
        expect(result.current.session).toBeNull();
      });

      it('signOut durante el handler de un login online: la persistencia posterior no escribe nada', async () => {
        const rolEnCamino = diferido<{ data: object; error: null }>();
        const single = jest.fn()
          .mockReturnValueOnce(rolEnCamino.promesa)
          .mockResolvedValue({ data: { rol: 'admin', activo: true }, error: null });
        (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single });
        const { result } = await montarYEsperarInit();
        (supabase.auth.signInWithPassword as jest.Mock).mockImplementation(async () => {
          const handler = ultimoListenerDeAuth()('SIGNED_IN', SESION_SDK);
          await new Promise((r) => setTimeout(r, 10));
          await result.current.signOut();
          (SecureStore.setItemAsync as jest.Mock).mockClear();
          rolEnCamino.resolver({ data: { rol: 'admin', activo: true }, error: null });
          await handler;
          return { data: { session: SESION_SDK }, error: null };
        });
        const { cacheCredential } = require('../../src/services/OfflineAuthService');

        await loguear(result);

        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        expect(cacheCredential).not.toHaveBeenCalled();
        expect(result.current.session).toBeNull();
      });

      it('login online completo (handler + persistencia): deja sesión y rol', async () => {
        perfil({ rol: 'admin', activo: true });
        const { result } = await montarYEsperarInit();
        (supabase.auth.signInWithPassword as jest.Mock).mockImplementation(async () => {
          await ultimoListenerDeAuth()('SIGNED_IN', SESION_SDK);
          return { data: { session: SESION_SDK }, error: null };
        });
        const { cacheCredential } = require('../../src/services/OfflineAuthService');

        const res = await loguear(result);

        expect(res.error).toBeNull();
        expect(result.current.session).toBe(SESION_SDK);
        expect(result.current.role).toBe('admin');
        expect(escribio('user_role', 'admin')).toBe(true);
        expect(cacheCredential).toHaveBeenCalledWith('test@test.com', 'password', 'admin', 'user-1');
      });
    });

    describe('carreras con el init', () => {

      it('si el listener confirma antes de que termine el init, revalida al terminar', async () => {
        const redEnCamino = diferido<object>();
        (NetInfo.fetch as jest.Mock).mockReturnValue(redEnCamino.promesa);
        (readSesionCacheada as jest.Mock).mockResolvedValue({ access_token: 'cached', refresh_token: 'cached-r' });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tecnico');
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: SESION_SDK } });
        perfil({ rol: 'admin', activo: true });
        const { result } = renderHook(() => useAuth());

        await act(async () => { await ultimoListenerDeRed()({ isConnected: true, isInternetReachable: true }); });
        expect(supabase.auth.getSession).not.toHaveBeenCalled();
        await act(async () => {
          redEnCamino.resolver(SIN_INTERNET);
          await new Promise((r) => setTimeout(r, 30));
        });

        expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
        expect(result.current.role).toBe('admin');
      });
    });

    it.each([
      ['conectado sin internet', setSinInternet],
      ['red desconocida', setRedDesconocida],
    ])('%s: un SIGNED_OUT del SDK no cierra la sesión', async (_caso, setRed) => {
      (readSesionCacheada as jest.Mock).mockResolvedValue({ access_token: 'cached', refresh_token: 'cached-r' });
      setOffline();
      const { result } = await montarYEsperarInit();
      expect(result.current.session).not.toBeNull();

      setRed();
      await act(async () => { await ultimoListenerDeAuth()('SIGNED_OUT', null); });

      expect(result.current.session).not.toBeNull();
    });

    it('con conexión confirmada, un SIGNED_OUT del SDK sí cierra la sesión', async () => {
      (readSesionCacheada as jest.Mock).mockResolvedValue({ access_token: 'cached', refresh_token: 'cached-r' });
      setOffline();
      const { result } = await montarYEsperarInit();

      setOnline();
      await act(async () => { await ultimoListenerDeAuth()('SIGNED_OUT', null); });

      expect(result.current.session).toBeNull();
    });
  });
});
