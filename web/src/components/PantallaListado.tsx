import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { TAMANO_ICONO } from '../theme/iconos';
import { Button } from './Button';
import { CabeceraSeccion } from './CabeceraSeccion';
import { EstadoConsulta, type ConsultaListado, type TextosConsulta } from './EstadoConsulta';
import { Topbar } from './Topbar';
import styles from './PantallaListado.module.css';

/** Los listados cuelgan todos de la misma sección, que no tiene pantalla propia. */
const RAIZ_LISTADOS = 'Organización';

interface AccionAlta {
  etiqueta: string;
  alActivar: () => void;
}

interface PantallaListadoProps {
  titulo: string;
  /** Resumen del total, junto al título. */
  meta?: string;
  /** Alta de la entidad, arriba a la derecha. */
  accion: AccionAlta;
  /** Búsqueda y filtros: visibles en todos los estados de la consulta. */
  barra: ReactNode;
  consulta: ConsultaListado;
  textos: TextosConsulta;
  /** El listado, cuando la consulta trajo filas. */
  children: ReactNode;
  modales?: ReactNode;
}

/**
 * Esqueleto de Especies, Plantaciones y Usuarios. La `<section>` no lleva
 * clase: el shell la hace columna acotada y, con poco alto o poco ancho, la
 * devuelve al scroll de documento.
 */
export function PantallaListado(props: PantallaListadoProps) {
  const { titulo, meta, accion, barra, consulta, textos, children, modales } = props;
  return (
    <section>
      <Topbar
        densidad="compacta"
        left={<CabeceraSeccion raiz={RAIZ_LISTADOS} titulo={titulo} meta={meta} />}
        right={
          <Button size="sm" onClick={accion.alActivar}>
            <Plus size={TAMANO_ICONO.md} aria-hidden />
            {accion.etiqueta}
          </Button>
        }
      />
      <div className={styles.contenido}>
        {barra}
        <EstadoConsulta consulta={consulta} textos={textos}>
          {children}
        </EstadoConsulta>
      </div>
      {modales}
    </section>
  );
}
