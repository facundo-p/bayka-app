import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PantallaListado, PlantacionFormModal, type TextosConsulta } from '../components';
import { useFiltrosListado } from '../hooks/useFiltrosListado';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarPlantaciones } from '../queries/plantationQueries';
import { ListadoPlantaciones } from './plantaciones/ListadoPlantaciones';
import { PlantacionesToolbar } from './plantaciones/PlantacionesToolbar';
import {
  filtrarPlantaciones,
  FILTROS_INICIALES_PLANTACIONES,
  resumenPlantaciones,
} from './plantaciones/filtros';

const TEXTOS: TextosConsulta = {
  error: 'No se pudieron cargar las plantaciones.',
  vacio: {
    titulo: 'Sin plantaciones',
    descripcion: 'Las plantaciones de tu organización van a aparecer acá.',
  },
};

export function PlantacionesScreen() {
  const consulta = useQuery({ queryKey: CLAVE_QUERY.plantaciones(), queryFn: listarPlantaciones });
  const { controles, visibles } = useFiltrosListado(
    consulta.data,
    filtrarPlantaciones,
    FILTROS_INICIALES_PLANTACIONES,
  );
  const [crearAbierto, setCrearAbierto] = useState(false);
  const cerrarCrear = () => setCrearAbierto(false);
  return (
    <PantallaListado
      titulo="Plantaciones"
      meta={consulta.data && resumenPlantaciones(consulta.data)}
      accion={{ etiqueta: 'Nueva plantación', alActivar: () => setCrearAbierto(true) }}
      barra={
        <PlantacionesToolbar controles={controles} todas={consulta.data} visibles={visibles} />
      }
      consulta={consulta}
      textos={TEXTOS}
      modales={crearAbierto && <PlantacionFormModal plantacion={null} onClose={cerrarCrear} />}
    >
      <ListadoPlantaciones visibles={visibles} />
    </PantallaListado>
  );
}
