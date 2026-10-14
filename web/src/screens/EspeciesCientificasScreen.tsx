import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PantallaListado, type TextosConsulta } from '../components';
import { useFiltrosListado } from '../hooks/useFiltrosListado';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarEspeciesCientificas } from '../queries/especieCientificaQueries';
import { EspeciesCientificasToolbar } from './especies/EspeciesCientificasToolbar';
import {
  filtrarCientificas,
  FILTROS_INICIALES_CIENTIFICAS,
  metaCientificas,
} from './especies/filtrosCientificas';
import {
  ListadoEspeciesCientificas,
  type SeleccionCientifica,
} from './especies/ListadoEspeciesCientificas';
import { PestanasEspecies } from './especies/PestanasEspecies';

const TEXTOS: TextosConsulta = {
  error: 'No se pudieron cargar las especies científicas.',
  vacio: {
    titulo: 'Sin especies científicas',
    descripcion: 'Cargá una para agrupar las especies que son la misma planta.',
  },
};

/** Especies científicas (#753): agrupan los nombres comunes regionales de una misma planta. */
export function EspeciesCientificasScreen() {
  const consulta = useQuery({
    queryKey: CLAVE_QUERY.especiesCientificas(),
    queryFn: listarEspeciesCientificas,
  });
  const { controles, visibles } = useFiltrosListado(
    consulta.data,
    filtrarCientificas,
    FILTROS_INICIALES_CIENTIFICAS,
  );
  const [seleccion, setSeleccion] = useState<SeleccionCientifica | null>(null);
  return (
    <PantallaListado
      titulo="Especies"
      meta={consulta.data && metaCientificas(consulta.data)}
      accion={{
        etiqueta: 'Nueva especie científica',
        alActivar: () => setSeleccion({ cientifica: null }),
      }}
      pestanas={<PestanasEspecies />}
      barra={<EspeciesCientificasToolbar controles={controles} visibles={visibles} />}
      consulta={consulta}
      textos={TEXTOS}
    >
      <ListadoEspeciesCientificas
        visibles={visibles}
        seleccion={seleccion}
        onSeleccionar={setSeleccion}
      />
    </PantallaListado>
  );
}
