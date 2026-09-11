import { useNavigate } from 'react-router';
import { rutaSeccion, type SegmentoDatos } from '../../lib/rutas';

/** Navegación a una sección hermana: el selector de la toolbar y los drill-downs. */
export function useIrASeccion() {
  const navigate = useNavigate();
  return (segmento: SegmentoDatos, filtros?: URLSearchParams) =>
    void navigate(rutaSeccion(segmento, filtros));
}
