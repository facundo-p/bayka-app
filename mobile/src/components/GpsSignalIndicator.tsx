import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { GPS_SIGNAL_UI_REFRESH_MS } from '../constants/gpsCapture';
import type { GpsFix, GpsPermissionStatus } from '../services/gps/locationClient';
import { getGpsSignalLevel } from '../services/gps/signalLevel';
import { formatGpsAccuracy } from '../utils/gpsAccuracyFormat';
import { GPS_LEVEL_COLOR } from './gpsLevelColors';
import { gpsSignalIndicatorStyles as styles } from './GpsSignalIndicator.styles';

export interface GpsSignalState {
  lastFix: GpsFix | null;
  permissionStatus: GpsPermissionStatus;
  servicesEnabled: boolean | null;
}

interface Props extends GpsSignalState {
  /** Ancho fijo y leyenda corta: alternar con/sin señal no desplaza lo que tiene al lado. */
  compact?: boolean;
}

const SIN_SENAL_LABEL = { full: 'Sin señal GPS', compact: 'Sin señal' } as const;

/** Tick periódico: sin fixes nuevos nada re-renderiza y un fix viejo
 *  quedaría mostrado como señal vigente. */
function useNowTick(intervalMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return nowMs;
}

/** Semáforo de fiabilidad de señal GPS: color + precisión en metros. */
export default function GpsSignalIndicator({ lastFix, permissionStatus, servicesEnabled, compact = false }: Props) {
  const nowMs = useNowTick(GPS_SIGNAL_UI_REFRESH_MS);
  const level = getGpsSignalLevel({ permissionStatus, servicesEnabled, fix: lastFix, nowMs });
  const color = GPS_LEVEL_COLOR[level];
  const label = level === 'sin-senal'
    ? SIN_SENAL_LABEL[compact ? 'compact' : 'full']
    : formatGpsAccuracy(lastFix!.accuracy);

  return (
    <View testID="gps-signal-indicator" style={[styles.container, compact && styles.compact, { borderColor: color }]}>
      <View testID={`gps-signal-dot-${level}`} style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}
