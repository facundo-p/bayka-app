import type { ReactNode } from 'react';
import { Button, Cargando, PuntoColor, SelectConDetalle } from '../../components';
import { useColorEspecie } from '../../hooks/useColoresEspecie';
import { cx } from '../../lib/classNames';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_NO_RESUELTA, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { BloqueDetalle } from './BloqueDetalle';
import { opcionesDeEspecie } from './cambioDeEspecie';
import {
  useCambioDeEspecie,
  type CambioDeEspecie,
  type EdicionDeEspecie,
} from './useCambioDeEspecie';
import styles from './BloqueEspecie.module.css';

export const ETIQUETA_CAMBIAR_ESPECIE = 'Cambiar';
export const ETIQUETA_IDENTIFICAR_ESPECIE = 'Identificar';
export const AVISO_SIN_IDENTIFICAR = 'Falta identificar la especie';

export const TEXTOS_SELECTOR_ESPECIE = {
  label: 'Especie nueva',
  placeholder: 'Elegí una especie',
  placeholderBusqueda: 'Buscar por código, nombre o nombre científico',
  textoVacio: 'La plantación no tiene especies habilitadas.',
  textoSinCoincidencias: 'Ninguna especie coincide.',
} as const;

const ERROR_CARGA_ESPECIES = 'No se pudieron cargar las especies de la plantación.';

/** N/N: el árbol no tiene especie asignada. */
function esSinIdentificar(arbol: ArbolDetalle): boolean {
  return arbol.especieId === null;
}

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

/** Nombre destacado con el código en un chip y, debajo, el científico o el aviso de N/N. */
function FichaDeEspecie({ arbol, accion }: { arbol: ArbolDetalle; accion?: ReactNode }) {
  const colorDe = useColorEspecie();
  const sinIdentificar = esSinIdentificar(arbol);
  const secundario = sinIdentificar ? AVISO_SIN_IDENTIFICAR : arbol.especieNombreCientifico;
  return (
    <div className={cx(styles.ficha, sinIdentificar && styles.sinIdentificar)}>
      <PuntoColor color={colorDe(arbol.especieCodigo)} tamano="lg" className={styles.punto} />
      <div className={styles.textos}>
        <span className={styles.nombre}>
          {arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR}
          <code className={styles.codigo}>{arbol.especieCodigo ?? ESPECIE_NO_RESUELTA}</code>
        </span>
        {secundario && <span className={styles.secundario}>{secundario}</span>}
      </div>
      {accion}
    </div>
  );
}

/** Un N/N pide identificarlo con un botón; una especie ya puesta se cambia con un enlace. */
function AccionDeEspecie({ arbol, abrir }: { arbol: ArbolDetalle; abrir: () => void }) {
  if (esSinIdentificar(arbol)) {
    return (
      <Button
        variant="contorno"
        size="sm"
        className={styles.botonIdentificar}
        onClick={abrir}
        aria-label="Identificar la especie"
      >
        {ETIQUETA_IDENTIFICAR_ESPECIE}
      </Button>
    );
  }
  return (
    <button type="button" className={styles.enlace} onClick={abrir} aria-label="Cambiar la especie">
      {ETIQUETA_CAMBIAR_ESPECIE}
    </button>
  );
}

function EspecieEditable({ arbol, edicion }: { arbol: ArbolDetalle; edicion: EdicionDeEspecie }) {
  const cambio = useCambioDeEspecie(arbol, edicion);
  const accion = !cambio.editando && <AccionDeEspecie arbol={arbol} abrir={cambio.abrir} />;
  return (
    <>
      <FichaDeEspecie arbol={arbol} accion={accion} />
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
    <BloqueDetalle titulo="Especie">
      {edicion ? (
        <EspecieEditable arbol={arbol} edicion={edicion} />
      ) : (
        <FichaDeEspecie arbol={arbol} />
      )}
    </BloqueDetalle>
  );
}
