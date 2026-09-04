import { useState } from 'react';

/**
 * Forma compartida de una descarga disparada por el usuario (KML, CSV, XLSX):
 * estado de carga + un mensaje inline para el caso "sin datos para exportar"
 * o un error genérico. `ejecutar` hace el trabajo real (cargar datos, armar
 * el archivo, disparar la descarga) y devuelve el mensaje a mostrar cuando no
 * hay nada que descargar, o `null` si la descarga se disparó con éxito.
 */
export function useDescarga(ejecutar: () => Promise<string | null>, mensajeError: string) {
  const [descargando, setDescargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function descargar() {
    setMensaje(null);
    setDescargando(true);
    try {
      const mensajeSinDatos = await ejecutar();
      if (mensajeSinDatos) setMensaje(mensajeSinDatos);
    } catch {
      setMensaje(mensajeError);
    } finally {
      setDescargando(false);
    }
  }

  return { descargar, descargando, mensaje };
}
