import { useState, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Cargando, ErrorConReintento, Input, SegmentedControl, Toggle } from '../../components';
import { obtenerPlantacion, type Plantacion } from '../../queries/plantationQueries';
import {
  actualizarConfigGps,
  MENSAJE_GPS_SIN_MIGRACION,
} from '../../repositories/plantationRepository';
import { cx } from '../../lib/classNames';
import { CabeceraConfig } from './CabeceraConfig';
import { useInvalidarPlantacion } from './useInvalidarPlantacion';
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

function mensajeErrorGuardar(error: Error | null): string | null {
  if (!error) return null;
  return error.message === MENSAJE_GPS_SIN_MIGRACION
    ? error.message
    : 'No se pudo guardar la configuración GPS.';
}

function esFrecuenciaValida(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 1;
}

function FormGps({ plantacion }: { plantacion: Plantacion }) {
  const [frecuencia, setFrecuencia] = useState(plantacion.gpsCaptureFrequency);
  const [textoExacto, setTextoExacto] = useState(String(plantacion.gpsCaptureFrequency));
  const [obligatoria, setObligatoria] = useState(plantacion.gpsCaptureRequired);
  const invalidar = useInvalidarPlantacion(plantacion.id);
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
    <div className={styles.formGps}>
      <div className={styles.filaToggle}>
        <div>
          <p className={styles.etiqueta}>Captura obligatoria</p>
          <p className={styles.textoAyuda}>
            {obligatoria
              ? 'El técnico no puede registrar sin GPS'
              : 'La captura de GPS es opcional'}
          </p>
        </div>
        <Toggle
          aria-label="Captura obligatoria"
          checked={obligatoria}
          disabled={guardar.isPending}
          onChange={aplicarObligatoria}
        />
      </div>

      <div className={styles.bloqueFrecuencia}>
        <p className={styles.etiqueta}>Frecuencia de captura — cada cuántos árboles</p>
        <p className={styles.textoAyuda}>Cada cuántos árboles se toma un punto GPS</p>
        <SegmentedControl
          aria-label="Frecuencia de captura"
          options={OPCIONES_FRECUENCIA}
          value={presetActivo}
          onChange={aplicarFrecuencia}
        />
        <div className={cx(styles.campoExacto, presetActivo === SIN_PRESET && styles.campoExactoActivo)}>
          <Input
            label="O un valor exacto: cada N árboles"
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

      {guardar.isError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeErrorGuardar(guardar.error)}
        </p>
      )}
    </div>
  );
}

/** Frecuencia y obligatoriedad de la captura GPS al registrar árboles. */
export function GpsConfigSection() {
  const { id = '' } = useParams();
  const plantacion = useQuery({
    queryKey: ['plantacion', id],
    queryFn: () => obtenerPlantacion(id),
  });

  return (
    <Card>
      <CabeceraConfig titulo="Captura de GPS" subtitulo="Cómo se registran los puntos en campo" />
      {plantacion.isPending && <Cargando />}
      {plantacion.isError && (
        <ErrorConReintento
          mensaje="No se pudo cargar la configuración GPS."
          onReintentar={() => void plantacion.refetch()}
        />
      )}
      {plantacion.data && <FormGps plantacion={plantacion.data} />}
    </Card>
  );
}
