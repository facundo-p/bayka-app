import { useQuery } from '@tanstack/react-query';
import { Cargando, SelectConDetalle } from '../../components';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarEspeciesCientificas } from '../../queries/especieCientificaQueries';
import { opcionesDeEspecieCientifica } from './opcionesCientificas';
import styles from './Especies.module.css';

const TEXTOS = {
  label: 'Especie científica',
  placeholder: 'Sin especie científica',
  placeholderBusqueda: 'Buscar especie científica',
  textoVacio: 'Todavía no hay especies científicas.',
  textoSinCoincidencias: 'Ninguna especie científica coincide.',
  hint: 'Se cargan en la pestaña Científicas.',
} as const;

const ERROR_CARGA = 'No se pudieron cargar las especies científicas.';

interface SelectorEspecieCientificaProps {
  /** La especie que se edita, o null en el alta. */
  especieId: string | null;
  value: string;
  onChange: (especieCientificaId: string) => void;
}

/** Solo se elige de la lista: las especies científicas se administran en su pestaña (#753). */
export function SelectorEspecieCientifica({
  especieId,
  value,
  onChange,
}: SelectorEspecieCientificaProps) {
  const cientificas = useQuery({
    queryKey: CLAVE_QUERY.especiesCientificas(),
    queryFn: listarEspeciesCientificas,
  });
  if (cientificas.isPending) return <Cargando />;
  if (cientificas.isError) return <p className={styles.errorEnvio}>{ERROR_CARGA}</p>;
  return (
    <SelectConDetalle
      {...TEXTOS}
      value={value}
      onChange={onChange}
      opciones={opcionesDeEspecieCientifica(cientificas.data, especieId)}
    />
  );
}
