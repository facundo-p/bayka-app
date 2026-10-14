import { useEffect, useState } from 'react';
import { GPS_AVISO_RESUELTO_MS } from '../constants/gpsCapture';
import type { GpsFix } from '../services/gps/locationClient';

export const AVISO_PUNTO_GPS = {
  esperando: 'esperando',
  tomado: 'tomado',
  sinPunto: 'sin-punto',
} as const;

export type AvisoPuntoGps =
  | { estado: typeof AVISO_PUNTO_GPS.esperando }
  | { estado: typeof AVISO_PUNTO_GPS.tomado; precision: number | null }
  | { estado: typeof AVISO_PUNTO_GPS.sinPunto };

function avisoResuelto(fix: GpsFix | null): AvisoPuntoGps {
  return fix ? { estado: AVISO_PUNTO_GPS.tomado, precision: fix.accuracy } : { estado: AVISO_PUNTO_GPS.sinPunto };
}

/** Muestra el punto mientras llega y, resuelto, un rato más; devuelve el cleanup del efecto. */
function seguirPunto(punto: Promise<GpsFix | null>, setAviso: (aviso: AvisoPuntoGps | null) => void) {
  let vigente = true;
  let ocultar: ReturnType<typeof setTimeout> | undefined;
  setAviso({ estado: AVISO_PUNTO_GPS.esperando });
  void punto.then((fix) => {
    if (!vigente) return;
    setAviso(avisoResuelto(fix));
    ocultar = setTimeout(() => setAviso(null), GPS_AVISO_RESUELTO_MS);
  });
  return () => {
    vigente = false;
    clearTimeout(ocultar);
  };
}

/** Estado del aviso del punto GPS del toque; null = nada que mostrar. Vive fuera de la cámara: reabrirla no lo reinicia. */
export function useAvisoPuntoGps(punto: Promise<GpsFix | null> | undefined): AvisoPuntoGps | null {
  const [aviso, setAviso] = useState<AvisoPuntoGps | null>(null);
  useEffect(() => {
    if (!punto) {
      setAviso(null);
      return;
    }
    return seguirPunto(punto, setAviso);
  }, [punto]);
  return aviso;
}
