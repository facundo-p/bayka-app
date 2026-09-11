import {
  Card,
  Cargando,
  ErrorConReintento,
  Input,
  SegmentedControl,
  Toggle,
} from '../../components';
import { useIdPlantacion } from '../../hooks/useIdPlantacion';
import { usePlantacion } from '../../hooks/usePlantacion';
import { cx } from '../../lib/classNames';
import type { Plantacion } from '../../queries/plantationQueries';
import { CabeceraConfig } from './CabeceraConfig';
import { ErrorAccion } from './ErrorAccion';
import { FilaConfig } from './FilaConfig';
import { PRESETS_FRECUENCIA, useCampoExacto, useFrecuenciaGps } from './useFrecuenciaGps';
import { useVisibilidadEnApp } from './useVisibilidadEnApp';
import styles from './SeccionesConfig.module.css';

/** "cada árbol" para 1, "árboles" para el resto. */
const OPCIONES_FRECUENCIA = PRESETS_FRECUENCIA.map((numero) => ({
  value: numero,
  label: String(numero),
  sublabel: numero === 1 ? 'cada árbol' : 'árboles',
}));

const AYUDA_VISIBILIDAD =
  'Si se desactiva, no verán esta plantación; sus datos pendientes igual sincronizan';

type EstadoGps = ReturnType<typeof useFrecuenciaGps>;

function FilaObligatoria({ gps }: { gps: EstadoGps }) {
  const ayuda = gps.obligatoria
    ? 'El técnico no puede registrar sin GPS'
    : 'La captura de GPS es opcional';
  return (
    <FilaConfig etiqueta="Captura de GPS obligatoria" ayuda={ayuda}>
      <Toggle
        aria-label="Captura de GPS obligatoria"
        checked={gps.obligatoria}
        disabled={gps.guardando}
        onChange={gps.aplicarObligatoria}
      />
    </FilaConfig>
  );
}

/** "o exacto" y su campo bajan de renglón juntos: separados no se entienden. */
function CampoExacto({ gps }: { gps: EstadoGps }) {
  const campo = useCampoExacto(gps.frecuencia, gps.aplicarFrecuencia);
  return (
    <div className={styles.grupoExacto}>
      <span className={styles.oExacto} aria-hidden>
        o exacto
      </span>
      <div className={cx(styles.campoExacto, gps.exactoActivo && styles.campoExactoActivo)}>
        <Input
          label="O un valor exacto: cada N árboles"
          labelOculto
          type="number"
          min={1}
          step={1}
          {...campo}
        />
      </div>
    </div>
  );
}

function FilaFrecuencia({ gps }: { gps: EstadoGps }) {
  return (
    <FilaConfig etiqueta="Frecuencia de captura" ayuda="Cada cuántos árboles se toma un punto GPS">
      <SegmentedControl
        aria-label="Frecuencia de captura"
        options={OPCIONES_FRECUENCIA}
        value={gps.presetActivo}
        onChange={gps.aplicarFrecuencia}
      />
      <CampoExacto gps={gps} />
    </FilaConfig>
  );
}

function FilasGps({ plantacion }: { plantacion: Plantacion }) {
  const gps = useFrecuenciaGps(plantacion);
  return (
    <>
      <FilaObligatoria gps={gps} />
      <FilaFrecuencia gps={gps} />
      <ErrorAccion mensaje={gps.mensajeError} />
    </>
  );
}

function FilaVisibilidad({ plantacion }: { plantacion: Plantacion }) {
  const visibilidad = useVisibilidadEnApp(plantacion);
  return (
    <>
      <FilaConfig etiqueta="Visible para técnicos en la app" ayuda={AYUDA_VISIBILIDAD}>
        <Toggle
          aria-label="Visible para técnicos en la app"
          checked={visibilidad.visible}
          disabled={visibilidad.guardando}
          onChange={visibilidad.cambiar}
        />
      </FilaConfig>
      <ErrorAccion mensaje={visibilidad.mensajeError} />
    </>
  );
}

function FilasComportamiento({ plantacion }: { plantacion: Plantacion }) {
  return (
    <div className={styles.filasComportamiento}>
      <FilasGps plantacion={plantacion} />
      <FilaVisibilidad plantacion={plantacion} />
    </div>
  );
}

/** Cómo se comporta la plantación en Bayka App: captura de GPS y visibilidad. */
export function ComportamientoConfigSection() {
  const id = useIdPlantacion();
  const plantacion = usePlantacion(id);
  return (
    <Card>
      <CabeceraConfig
        titulo="Comportamiento en la app"
        subtitulo="GPS y visibilidad para los técnicos"
      />
      {plantacion.isPending && <Cargando />}
      {plantacion.isError && (
        <ErrorConReintento
          mensaje="No se pudo cargar la configuración de la plantación."
          onReintentar={() => void plantacion.refetch()}
        />
      )}
      {plantacion.data && <FilasComportamiento plantacion={plantacion.data} />}
    </Card>
  );
}
