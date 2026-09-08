import { Search } from 'lucide-react';
import { cx } from '../lib/classNames';
import { Input } from './Input';
import styles from './CampoBusqueda.module.css';

const TAMANO_ICONO = 14;

interface CampoBusquedaProps {
  /** Nombre accesible del campo; queda oculto a la vista. */
  label: string;
  placeholder: string;
  value: string;
  onChange: (texto: string) => void;
  /** `compacta`: más angosto, para cuando comparte renglón con otros filtros. */
  densidad?: 'normal' | 'compacta';
}

/** Buscador de un listado: lupa dentro del campo, label oculto. */
export function CampoBusqueda({
  label,
  placeholder,
  value,
  onChange,
  densidad = 'normal',
}: CampoBusquedaProps) {
  return (
    <div className={cx(styles.campo, densidad === 'compacta' && styles.compacta)}>
      <Search className={styles.icono} size={TAMANO_ICONO} aria-hidden />
      <Input
        label={label}
        labelOculto
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
      />
    </div>
  );
}
