import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PantallaListado, type TextosConsulta } from '../components';
import { useFiltrosListado } from '../hooks/useFiltrosListado';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarCatalogoConUso, type EspecieConCatalogoUso } from '../queries/especieQueries';
import { EspeciesToolbar } from './especies/EspeciesToolbar';
import { contarEnUso, filtrarEspecies, FILTROS_INICIALES_ESPECIES } from './especies/filtros';
import { ListadoEspecies, type Seleccion } from './especies/ListadoEspecies';

const TEXTOS: TextosConsulta = {
  error: 'No se pudieron cargar las especies.',
  vacio: { titulo: 'Sin especies', descripcion: 'El catálogo de especies va a aparecer acá.' },
};

/** Meta de la cabecera: tamaño del catálogo y cuántas están en uso. */
function metaCatalogo(catalogo: EspecieConCatalogoUso[]): string {
  return `Catálogo global · ${catalogo.length} especies nativas · ${contarEnUso(catalogo)} en uso`;
}

export function EspeciesScreen() {
  const consulta = useQuery({
    queryKey: CLAVE_QUERY.especiesCatalogoUso(),
    queryFn: listarCatalogoConUso,
  });
  const { controles, visibles } = useFiltrosListado(
    consulta.data,
    filtrarEspecies,
    FILTROS_INICIALES_ESPECIES,
  );
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  return (
    <PantallaListado
      titulo="Especies"
      meta={consulta.data && metaCatalogo(consulta.data)}
      accion={{ etiqueta: 'Nueva especie', alActivar: () => setSeleccion({ especie: null }) }}
      barra={<EspeciesToolbar controles={controles} visibles={visibles} />}
      consulta={consulta}
      textos={TEXTOS}
    >
      <ListadoEspecies visibles={visibles} seleccion={seleccion} onSeleccionar={setSeleccion} />
    </PantallaListado>
  );
}
