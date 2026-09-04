import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, Card, PasswordInput } from '../components';
import {
  actualizarPasswordUsuario,
  obtenerSesionActual,
  suscribirseACambiosDeSesion,
} from '../services/authService';
import { MENSAJES as MENSAJES_ADMIN_USERS } from '../../../supabase/functions/admin-users/nucleo';
import { validarNuevaPassword } from '../lib/validarPassword';
import styles from './EstablecerPasswordScreen.module.css';

const MENSAJE_LINK_INVALIDO =
  'El link expiró o ya fue usado. Pedile a un administrador que te reenvíe la invitación.';
const MENSAJE_EXITO = 'Contraseña lista. Ya podés ingresar con tu email.';
const NOTA_TECNICOS = 'Si sos técnico, ingresá desde la app Bayka en tu teléfono.';

type EstadoSesion = 'cargando' | 'con-sesion' | 'sin-sesion';

/** El link de invitación/recuperación trae la sesión en el hash de la URL y
 *  el SDK la procesa en segundo plano: se escucha el evento además del estado
 *  inicial para no dar falso "link inválido" mientras tanto. */
function useSesionDelLink(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>('cargando');
  useEffect(() => {
    void obtenerSesionActual().then((sesion) => {
      setEstado(sesion ? 'con-sesion' : 'sin-sesion');
    });
    return suscribirseACambiosDeSesion((sesion) => {
      if (sesion) setEstado('con-sesion');
    });
  }, []);
  return estado;
}

function FormularioPassword({ onExito }: { onExito: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
    const invalidez = validarNuevaPassword(password, confirmacion);
    if (invalidez) {
      setError(invalidez);
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: errorUpdate } = await actualizarPasswordUsuario(password);
    if (errorUpdate) {
      setError(MENSAJES_ADMIN_USERS.errorGenerico);
      setEnviando(false);
      return;
    }
    onExito();
  }

  return (
    <form className={styles.formulario} onSubmit={manejarSubmit}>
      <PasswordInput
        label="Contraseña nueva"
        autoComplete="new-password"
        required
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
      />
      <PasswordInput
        label="Repetir contraseña"
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
