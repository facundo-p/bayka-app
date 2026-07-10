import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, Card, Input } from '../components';
import { supabase } from '../lib/supabase';
import {
  LONGITUD_MINIMA_PASSWORD,
  MENSAJES as MENSAJES_ADMIN_USERS,
} from '../../../supabase/functions/admin-users/nucleo';
import styles from './EstablecerPasswordScreen.module.css';

const MENSAJE_LINK_INVALIDO =
  'El link expiró o ya fue usado. Pedile a un administrador que te reenvíe la invitación.';
const MENSAJE_NO_COINCIDEN = 'Las contraseñas no coinciden';
const MENSAJE_EXITO = 'Contraseña lista. Ya podés ingresar con tu email.';
const NOTA_TECNICOS = 'Si sos técnico, ingresá desde la app Bayka en tu teléfono.';

type EstadoSesion = 'cargando' | 'con-sesion' | 'sin-sesion';

/** El link de invitación/recuperación trae la sesión en el hash de la URL y
 *  el SDK la procesa en segundo plano: se escucha el evento además del estado
 *  inicial para no dar falso "link inválido" mientras tanto. */
function useSesionDelLink(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>('cargando');
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setEstado(data.session ? 'con-sesion' : 'sin-sesion');
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session) setEstado('con-sesion');
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return estado;
}

function validar(password: string, confirmacion: string): string | null {
  if (password.length < LONGITUD_MINIMA_PASSWORD) return MENSAJES_ADMIN_USERS.passwordCorta;
  if (password !== confirmacion) return MENSAJE_NO_COINCIDEN;
  return null;
}

function FormularioPassword({ onExito }: { onExito: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
    const invalidez = validar(password, confirmacion);
    if (invalidez) {
      setError(invalidez);
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: errorUpdate } = await supabase.auth.updateUser({ password });
    if (errorUpdate) {
      setError(MENSAJES_ADMIN_USERS.errorGenerico);
      setEnviando(false);
      return;
    }
    onExito();
  }

  return (
    <form className={styles.formulario} onSubmit={manejarSubmit}>
      <Input
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
      />
      <Input
        label="Repetir contraseña"
        type="password"
        autoComplete="new-password"
        required
        value={confirmacion}
        onChange={(evento) => setConfirmacion(evento.target.value)}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={enviando}>
        Guardar contraseña
      </Button>
    </form>
  );
}

function Exito() {
  return (
    <div className={styles.exito} role="status">
      <p>{MENSAJE_EXITO}</p>
      <p className={styles.nota}>{NOTA_TECNICOS}</p>
      <Link to="/login" className={styles.enlace}>
        Ir al ingreso de la web
      </Link>
    </div>
  );
}

/** Destino público del link de invitación / recuperación de contraseña.
 *  Vive fuera del gate de acceso: un técnico (sin acceso a la web) también
 *  define acá su contraseña, una sola vez, y después usa la app. */
export function EstablecerPasswordScreen() {
  const sesion = useSesionDelLink();
  const [guardada, setGuardada] = useState(false);

  return (
    <div className={styles.fondo}>
      <Card className={styles.panel}>
        <h1 className={styles.titulo}>Definí tu contraseña</h1>
        {sesion === 'cargando' && null}
        {sesion === 'sin-sesion' && !guardada && (
          <p className={styles.error} role="alert">
            {MENSAJE_LINK_INVALIDO}
          </p>
        )}
        {sesion === 'con-sesion' &&
          (guardada ? <Exito /> : <FormularioPassword onExito={() => setGuardada(true)} />)}
      </Card>
    </div>
  );
}
