import { useId, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from '../lib/classNames';
import { FormField } from './FormField';
import styles from './PasswordInput.module.css';

/** Etiquetas accesibles del toggle: son el nombre del botón para el lector de
 *  pantalla (el ícono es decorativo), por eso viven nombradas y no inline. */
const ETIQUETA_MOSTRAR = 'Mostrar contraseña';
const ETIQUETA_OCULTAR = 'Ocultar contraseña';
const TAMANO_ICONO = 18;

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Oculta el label visualmente (toolbars densas); sigue accesible. */
  labelOculto?: boolean;
};

/** Campo de contraseña con "ojito" para alternar entre oculta y visible.
 *  Mismo contrato que `Input` salvo `type`, que lo maneja el toggle. */
export function PasswordInput({
  label,
  error,
  hint,
  labelOculto,
  id,
  className,
  ...rest
}: PasswordInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const Icono = visible ? EyeOff : Eye;

  return (
    <FormField id={inputId} label={label} hint={hint} error={error} labelOculto={labelOculto}>
      <div className={styles.contenedor}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          className={cx(styles.input, error && styles.inputError, className)}
          {...rest}
        />
        {/* type="button": dentro de un <form> el default es submit y el ojito
            no debe enviar el formulario. */}
        <button
          type="button"
          className={styles.ojito}
          onClick={() => setVisible((estaVisible) => !estaVisible)}
          aria-label={visible ? ETIQUETA_OCULTAR : ETIQUETA_MOSTRAR}
          aria-pressed={visible}
        >
          <Icono size={TAMANO_ICONO} aria-hidden />
        </button>
      </div>
    </FormField>
  );
}
