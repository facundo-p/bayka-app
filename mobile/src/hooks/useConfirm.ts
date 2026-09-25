import { useState, useCallback, useRef } from 'react';
import type { ConfirmModalButton } from '../components/ConfirmModal';

type IconName = string;

type ConfirmConfig = {
  icon?: IconName;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
  // Con 2+ botones, qué correr si se cierra por back/backdrop en vez de tocar un botón
  // (ninguno de los onPress corre solo). Sin esto, un caller que espera una Promise
  // de alguno de los botones queda colgado (#659).
  onDismiss?: () => void;
};

export function useConfirm() {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  // Con un solo botón el diálogo es informativo, no una decisión: cerrarlo por back o
  // backdrop equivale a tocarlo, para no perder un paso encadenado a su onPress (#656).
  // Con 2+ botones cerrar por fuera es cancelar: dispara `onDismiss` si el caller lo dio.
  const accionAlCerrarRef = useRef<(() => void) | null>(null);

  const show = useCallback((cfg: ConfirmConfig) => {
    accionAlCerrarRef.current = cfg.buttons.length === 1 ? cfg.buttons[0].onPress : (cfg.onDismiss ?? null);
    // Wrap each button's onPress to auto-dismiss
    const wrappedButtons = cfg.buttons.map((btn) => ({
      ...btn,
      onPress: () => {
        accionAlCerrarRef.current = null;
        setConfig(null);
        btn.onPress();
      },
    }));
    setConfig({ ...cfg, buttons: wrappedButtons });
  }, []);

  const dismiss = useCallback(() => {
    const accion = accionAlCerrarRef.current;
    accionAlCerrarRef.current = null;
    setConfig(null);
    accion?.();
  }, []);

  return {
    confirmProps: config
      ? { visible: true, ...config, onDismiss: dismiss }
      : { visible: false, icon: undefined, iconColor: undefined, title: '', message: '', buttons: [] as ConfirmModalButton[], onDismiss: dismiss },
    show,
    dismiss,
  };
}
