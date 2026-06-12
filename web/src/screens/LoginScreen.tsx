import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { Button, Card, Input } from '../components';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginScreen.module.css';

function MarcaBayka() {
  return (
    <div className={styles.marca}>
      <span className={styles.wordmark}>BAYKA</span>
      <span className={styles.subtitulo}>Gestión</span>
    </div>
  );
}

function FormularioLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    const resultado = await signIn(email, password);
    // Con éxito el provider cambia de estado y LoginScreen redirige solo.
    if (resultado.error) {
      setError(resultado.error);
      setEnviando(false);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={manejarSubmit}>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
      />
      <Input
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={enviando}>
        Ingresar
      </Button>
    </form>
  );
}

export function LoginScreen() {
  const { estado } = useAuth();

  // Con sesión ya resuelta el gate de rutas decide qué mostrar.
  if (estado === 'autenticado' || estado === 'sin-acceso') {
    return <Navigate to="/plantaciones" replace />;
  }

  return (
    <div className={styles.fondo}>
      <Card className={styles.panel}>
        <MarcaBayka />
        <FormularioLogin />
      </Card>
    </div>
  );
}
