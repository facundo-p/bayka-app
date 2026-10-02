import { Button, Cargando, PanelBloque, SelectConDetalle } from '../../components';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { opcionesDeEspecie } from './cambioDeEspecie';
import { EspecieConPunto } from './celdas';
import {
  useCambioDeEspecie,
  type CambioDeEspecie,
  type EdicionDeEspecie,
} from './useCambioDeEspecie';
import styles from './BloqueEspecie.module.css';

export const ETIQUETA_CAMBIAR_ESPECIE = 'Cambiar';

export const TEXTOS_SELECTOR_ESPECIE = {
  label: 'Especie nueva',
  placeholder: 'Elegí una especie',
  placeholderBusqueda: 'Buscar por código, nombre o nombre científico',
  textoVacio: 'La plantación no tiene especies habilitadas.',
  textoSinCoincidencias: 'Ninguna especie coincide.',
} as const;

const ERROR_CARGA_ESPECIES = 'No se pudieron cargar las especies de la plantación.';

function SelectorDeEspecie({ cambio }: { cambio: CambioDeEspecie }) {
  const { especies } = cambio;
  if (especies.isPending) return <Cargando />;
  if (especies.isError) return <p className={styles.error}>{ERROR_CARGA_ESPECIES}</p>;
  return (
    <SelectConDetalle
      {...TEXTOS_SELECTOR_ESPECIE}
      value={cambio.elegida}
      onChange={cambio.setElegida}
      opciones={opcionesDeEspecie(especies.data)}
    />
  );
}

function FormularioDeEspecie({ cambio }: { cambio: CambioDeEspecie }) {
  return (
    <div className={styles.formulario}>
      <SelectorDeEspecie cambio={cambio} />
      {cambio.mensajeError && (
        <p className={styles.error} role="alert">
          {cambio.mensajeError}
        </p>
      )}
      <div className={styles.acciones}>
        <Button variant="contorno" size="sm" onClick={cambio.cancelar} disabled={cambio.guardando}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={cambio.guardar}
          loading={cambio.guardando}
          disabled={!cambio.puedeGuardar}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}

function EspecieEditable({ arbol, edicion }: { arbol: ArbolDetalle; edicion: EdicionDeEspecie }) {
  const cambio = useCambioDeEspecie(arbol, edicion);
  return (
    <>
      <div className={styles.fila}>
        <EspecieConPunto arbol={arbol} tamano="lg" className={styles.especie} />
        {!cambio.editando && (
          <button
            type="button"
            className={styles.enlace}
            onClick={cambio.abrir}
            aria-label="Cambiar la especie"
          >
            {ETIQUETA_CAMBIAR_ESPECIE}
          </button>
        )}
      </div>
      {cambio.editando && <FormularioDeEspecie cambio={cambio} />}
    </>
  );
}

/** Sin `edicion`, la especie es de solo lectura. */
export function BloqueEspecie({
  arbol,
  edicion,
}: {
  arbol: ArbolDetalle;
  edicion?: EdicionDeEspecie;
}) {
  return (
    <PanelBloque titulo="Especie">
      {edicion ? (
        <EspecieEditable arbol={arbol} edicion={edicion} />
      ) : (
        <EspecieConPunto arbol={arbol} tamano="lg" className={styles.especie} />
      )}
    </PanelBloque>
  );
}
