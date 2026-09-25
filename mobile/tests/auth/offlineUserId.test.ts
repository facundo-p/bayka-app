/**
 * Celular compartido (#658): el login offline deja cacheados el userId y el rol
 * de quien entra, y nunca reusa los tokens de otra cuenta. Corre useAuth contra
 * el auth.ts y el OfflineAuthService reales, con SecureStore en memoria.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { setOffline, setOnline } from '../helpers/networkHelper';

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      startAutoRefresh: jest.fn().mockResolvedValue(undefined),
      stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

const { supabase } = require('../../src/supabase/client');
import { useAuth } from '../../src/hooks/useAuth';
import { readSesionCacheada, SESION_SOLO_LOCAL } from '../../src/supabase/auth';

const USER_ID_KEY = 'user_id';
const ROLE_KEY = 'user_role';
const ACCESS_TOKEN_KEY = 'supabase_access_token';
const SDK_KEY = 'sb-proyecto-auth-token';
const EMAIL_KEY = 'last_email';

const A = { email: 'a@bayka.com', password: 'passA', id: 'user-a', rol: 'admin' };
const B = { email: 'b@bayka.com', password: 'passB', id: 'user-b', rol: 'tecnico' };
type Cuenta = typeof A;

let store: Map<string, string>;
let sdkKeys: string[];

beforeEach(() => {
  store = new Map();
  sdkKeys = [];
  jest.clearAllMocks();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => store.get(k) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (k: string, v: string) => { store.set(k, v); });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k: string) => { store.delete(k); });
  (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => sdkKeys);
  (AsyncStorage.multiRemove as jest.Mock).mockImplementation(async (keys: string[]) => {
    sdkKeys = sdkKeys.filter(k => !keys.includes(k));
  });
});

/** Un rol que no llega (timeout o error) cae al rol cacheado de esa cuenta. */
const ROL_SIN_RESPUESTA = () => Promise.reject(new Error('timeout'));

async function loginOnline(cuenta: Cuenta, perfil = () => Promise.resolve({ data: { rol: cuenta.rol, activo: true }, error: null })) {
  setOnline();
  sdkKeys = [SDK_KEY];
  (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    data: { session: { access_token: `token-${cuenta.id}`, refresh_token: `refresh-${cuenta.id}`, user: { id: cuenta.id, email: cuenta.email } } },
    error: null,
  });
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(perfil),
  });
  const { result } = renderHook(() => useAuth());
  await act(async () => { await result.current.signIn(cuenta.email, cuenta.password); });
  await act(async () => { await result.current.signOut(); });
}

async function loginOffline(cuenta: Cuenta) {
  setOffline();
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let res: any;
  await act(async () => { res = await result.current.signIn(cuenta.email, cuenta.password); });
  return { res, result };
}

describe('login offline en un celular compartido (#658)', () => {
  it('B offline después de A online deja cacheados el userId y el rol de B', async () => {
    await loginOnline(B);
    await loginOnline(A);

    const { res, result } = await loginOffline(B);

    expect(res.error).toBeNull();
    expect(store.get(USER_ID_KEY)).toBe('user-b');
    expect(store.get(ROLE_KEY)).toBe('tecnico');
    expect(result.current.role).toBe('tecnico');
  });

  it('no reusa los tokens ni la sesión del SDK de A', async () => {
    await loginOnline(B);
    await loginOnline(A);
    sdkKeys = [SDK_KEY];

    const { res } = await loginOffline(B);

    expect(res.data.session).toBe(SESION_SOLO_LOCAL);
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(sdkKeys).toEqual([]);
  });

  it('la sesión solo local sobrevive a reabrir la app', async () => {
    await loginOnline(B);
    await loginOnline(A);
    await loginOffline(B);

    const reabierta = renderHook(() => useAuth()).result;
    await waitFor(() => expect(reabierta.current.loading).toBe(false));

    expect(reabierta.current.session).toBe(SESION_SOLO_LOCAL);
    expect(await readSesionCacheada()).toBe(SESION_SOLO_LOCAL);
  });

  it('la misma cuenta offline conserva sus tokens', async () => {
    await loginOnline(A);

    const { res } = await loginOffline(A);

    expect(res.data.session).toEqual({ access_token: 'token-user-a', refresh_token: 'refresh-user-a' });
    expect(store.get(USER_ID_KEY)).toBe('user-a');
  });

  it('un login online de B después reemplaza la sesión solo local', async () => {
    await loginOnline(B);
    await loginOnline(A);
    await loginOffline(B);

    await loginOnline(B);

    expect(store.get(USER_ID_KEY)).toBe('user-b');
    expect(await readSesionCacheada()).toEqual({ access_token: 'token-user-b', refresh_token: 'refresh-user-b' });
  });

  it('una credencial sin userId (anterior a #658) exige login online', async () => {
    await loginOnline(A);
    const credenciales = JSON.parse(store.get('offline_credentials')!);
    delete credenciales[0].userId;
    store.set('offline_credentials', JSON.stringify(credenciales));

    const { res } = await loginOffline(A);

    expect(res.error.message).toBe('Iniciá sesión con conexión una vez para habilitar el acceso sin conexión.');
    expect(res.data.session).toBeNull();
  });

  it('con una credencial sin userId y contraseña incorrecta, sigue el mensaje de credenciales', async () => {
    await loginOnline(A);
    const credenciales = JSON.parse(store.get('offline_credentials')!);
    delete credenciales[0].userId;
    store.set('offline_credentials', JSON.stringify(credenciales));

    setOffline();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let res: any;
    await act(async () => { res = await result.current.signIn(A.email, 'mala'); });

    expect(res.error.message).toBe('Credenciales incorrectas o no guardadas. Iniciá sesión online primero.');
  });

  it('signOut cierra la sesión solo local', async () => {
    await loginOnline(B);
    await loginOnline(A);
    const { result } = await loginOffline(B);

    await act(async () => { await result.current.signOut(); });

    expect(await readSesionCacheada()).toBeNull();
  });
});

/** El email cacheado identifica la cuenta de los tokens: no puede quedar el de la anterior (#668). */
describe('email de la cuenta online', () => {
  it('se cachea aunque el rol no llegue, si B ya tenía rol cacheado', async () => {
    await loginOnline(B);
    await loginOnline(A);
    await loginOnline(B, ROL_SIN_RESPUESTA);

    expect(store.get(EMAIL_KEY)).toBe(B.email);
    expect(store.get(USER_ID_KEY)).toBe(B.id);
  });

  it('sin rol de B el login se descarta y no queda la cuenta de A', async () => {
    await loginOnline(A);
    await loginOnline(B, ROL_SIN_RESPUESTA);

    expect(store.has(EMAIL_KEY)).toBe(false);
    expect(store.has(USER_ID_KEY)).toBe(false);
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
  });
});
