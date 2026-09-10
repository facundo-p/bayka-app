import { useState, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Card, Cargando, ErrorConReintento, Input, SegmentedControl, Toggle } from '../../components';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { usePlantacion } from '../../hooks/usePlantacion';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { Plantacion } from '../../queries/plantationQueries';
import {
  actualizarConfigGps,
  actualizarVisibilidad,
  MENSAJE_GPS_SIN_MIGRACION,
  MENSAJE_VISIBILIDAD_SIN_MIGRACION,
} from '../../repositories/plantationRepository';
import { cx } from '../../lib/classNames';
import { CabeceraConfig } from './CabeceraConfig';
import { FilaConfig } from './FilaConfig';
import styles from './SeccionesConfig.module.css';

/** Presets de frecuencia (cada cuántos árboles se toma un punto GPS). */
const PRESETS_FRECUENCIA = [1, 5, 10, 20] as const;

/** Opciones del segmentado: "cada árbol" para 1, "árboles" para el resto. */
const OPCIONES_FRECUENCIA = PRESETS_FRECUENCIA.map((numero) => ({
  value: numero,
  label: String(numero),
  sublabel: numero === 1 ? 'cada árbol' : 'árboles',
}));

/** value del segmentado cuando la frecuencia no es un preset (ninguno activo). */
const SIN_PRESET = -1;

const AYUDA_VISIBILIDAD =
  'Si se desactiva, no verán esta plantación; sus datos pendientes igual sincronizan';

function mensajeErrorGuardar(error: Error | null): string | null {
  if (!error) return null;
  return error.message === MENSAJE_GPS_SIN_MIGRACION
    ? error.message
    : 'No se pudo guardar la configuración GPS.';
}

/** El mensaje de migración faltante se muestra tal cual; el resto, genérico. */
function mensajeErrorVisibilidad(error: Error | null): string | null {
  if (!error) return null;
  return error.message === MENSAJE_VISIBILIDAD_SIN_MIGRACION
    ? error.message
    : 'No se pudo actualizar la visibilidad.';
}

function esFrecuenciaValida(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 1;
}

/** Obligatoriedad y frecuencia comparten payload, así que comparten estado. */
function FilasGps({ plantacion }: { plantacion: Plantacion }) {
  const [frecuencia, setFrecuencia] = useState(plantacion.gpsCaptureFrequency);
  const [textoExacto, setTextoExacto] = useState(String(plantacion.gpsCaptureFrequency));
  const [obligatoria, setObligatoria] = useState(plantacion.gpsCaptureRequired);
  const invalidar = useInvalidarConListado(CLAVE_QUERY.plantacion(plantacion.id));
  const guardar = useMutation({
    mutationFn: (config: { frecuencia: number; obligatoria: boolean }) =>
      actualizarConfigGps(plantacion.id, config),
    onSuccess: invalidar,
  });

  const presetActivo = (PRESETS_FRECUENCIA as readonly number[]).includes(frecuencia)
    ? frecuencia
    : SIN_PRESET;

  // Presets y input numérico comparten el mismo entero `frecuencia`.
  const aplicarFrecuencia = (nueva: number) => {
    setFrecuencia(nueva);
    setTextoExacto(String(nueva));
    guardar.mutate({ frecuencia: nueva, obligatoria });
  };
  const aplicarObligatoria = (valor: boolean) => {
    setObligatoria(valor);
    guardar.mutate({ frecuencia, obligatoria: valor });
  };
  // El input solo actualiza el texto en cada tecla; persiste una única vez al
  // confirmar (blur o Enter), no en cada keystroke. Un valor inválido al
  // confirmar no llega a la base: el campo vuelve al último valor válido.
  const confirmarTextoExacto = () => {
    const valor = Number(textoExacto.trim());
    if (esFrecuenciaValida(valor)) aplicarFrecuencia(valor);
    else setTextoExacto(String(frecuencia));
  };
  const manejarTeclaTextoExacto = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    confirmarTextoExacto();
  };

  return (
    <>
      <FilaConfig
        etiqueta="Captura de GPS obligatoria"
        ayuda={
          obligatoria ? 'El técnico no puede registrar sin GPS' : 'La captura de GPS es opcional'
        }
      >
        <Toggle
          aria-label="Captura de GPS obligatoria"
          checked={obligatoria}
          disabled={guardar.isPending}
          onChange={aplicarObligatoria}
        />
      </FilaConfig>

      <FilaConfig
        etiqueta="Frecuencia de captura"
        ayuda="Cada cuántos árboles se toma un punto GPS"
      >
        <SegmentedControl
          aria-label="Frecuencia de captura"
          options={OPCIONES_FRECUENCIA}
          value={presetActivo}
          onChange={aplicarFrecuencia}
        />
        <div className={styles.grupoExacto}>
          <span className={styles.oExacto} aria-hidden>
            o exacto
          </span>
          <div
            className={cx(
              styles.campoExacto,
              presetActivo === SIN_PRESET && styles.campoExactoActivo,
            )}
          >
            <Input
              label="O un valor exacto: cada N árboles"
              labelOculto
              type="number"
              min={1}
              step={1}
              value={textoExacto}
              onChange={(event) => setTextoExacto(event.target.value)}
              onBlur={confirmarTextoExacto}
              onKeyDown={manejarTeclaTextoExacto}
            />
          </div>
        </div>
      </FilaConfig>

      {guardar.isError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeErrorGuardar(guardar.error)}
        </p>
      )}
    </>
  );
}

function FilaVisibilidad({ plantacion }: { plantacion: Plantacion }) {
  // Estado local para feedback inmediato: el guardado es al cambiar, sin
  // botón aparte, y si el update falla se vuelve al valor anterior.
  const [visible, setVisible] = useState(plantacion.visibleInApp);
  const invalidar = useInvalidarConListado(CLAVE_QUERY.plantacion(plantacion.id));
  const mutacion = useMutation({
    mutationFn: (nuevoValor: boolean) => actualizarVisibilidad(plantacion.id, nuevoValor),
    onSuccess: invalidar,
    onError: (_error, nuevoValor) => setVisible(!nuevoValor),
  });
  const cambiar = (nuevoValor: boolean) => {
    setVisible(nuevoValor);
    mutacion.mutate(nuevoValor);
  };

  return (
    <>
      <FilaConfig etiqueta="Visible para técnicos en la app" ayuda={AYUDA_VISIBILIDAD}>
        <Toggle
          aria-label="Visible para técnicos en la app"
          checked={visible}
          disabled={mutacion.isPending}
          onChange={cambiar}
        />
      </FilaConfig>
      {mutacion.isError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeErrorVisibilidad(mutacion.error)}
        </p>
      )}
    </>
  );
}

/** Cómo se comporta la plantación en Bayka App: captura de GPS y visibilidad. */
export function ComportamientoConfigSection() {
  const { id = '' } = useParams();
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
      {plantacion.data && (
        <div className={styles.filasComportamiento}>
          <FilasGps plantacion={plantacion.data} />
          <FilaVisibilidad plantacion={plantacion.data} />
        </div>
      )}
    </Card>
  );
}
