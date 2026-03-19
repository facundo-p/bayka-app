import { useState, useCallback } from 'react';
import type { ConfirmModalButton } from '../components/ConfirmModal';

type IconName = string;

type ConfirmConfig = {
  icon?: IconName;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
};

export function useConfirm() {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);

  const show = useCallback((cfg: ConfirmConfig) => {
    // Wrap each button's onPress to auto-dismiss
    const wrappedButtons = cfg.buttons.map((btn) => ({
      ...btn,
      onPress: () => {
        setConfig(null);
        btn.onPress();
      },
    }));
    setConfig({ ...cfg, buttons: wrappedButtons });
  }, []);

  const dismiss = useCallback(() => setConfig(null), []);

  return {
    confirmProps: config
      ? { visible: true, ...config, onDismiss: dismiss }
      : { visible: false, icon: undefined, iconColor: undefined, title: '', message: '', buttons: [] as ConfirmModalButton[], onDismiss: dismiss },
    show,
    dismiss,
  };
}
