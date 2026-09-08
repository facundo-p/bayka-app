import { Search } from 'lucide-react';
import { Input } from './Input';
import styles from './CampoBusqueda.module.css';

const TAMANO_ICONO = 14;

interface CampoBusquedaProps {
  /** Nombre accesible del campo; queda oculto a la vista. */
  label: string;
  placeholder: string;
  value: string;
  onChange: (texto: string) => void;
}

/** Buscador de un listado: lupa dentro del campo, label oculto. */
export function CampoBusqueda({ label, placeholder, value, onChange }: CampoBusquedaProps) {
  return (
    <div className={styles.campo}>
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
