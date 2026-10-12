import { useLayoutEffect } from 'react';

/** Marca en `<html>` mientras hay un modal abierto: theme.css corta el scroll con ella. */
export const ATRIBUTO_SCROLL_BLOQUEADO = 'data-scroll-bloqueado';

/** `conBarra`: la barra de scroll ocupaba lugar y theme.css se lo reserva al ocultarla. */
export const MARCA_SCROLL_BLOQUEADO = {
  conBarra: 'con-barra',
  sinBarra: 'sin-barra',
} as const;

// Compartido entre todos los modales: el primero bloquea, el último libera.
const bloqueo = { abiertos: 0, posicion: 0, url: '' };

/** Barra clásica: ocupa ancho. La de superposición (teléfono, macOS) no. */
function barraOcupaLugar(): boolean {
  return window.innerWidth > document.documentElement.clientWidth;
}

function bloquear() {
  bloqueo.abiertos += 1;
  if (bloqueo.abiertos > 1) return;
  bloqueo.posicion = window.scrollY;
  bloqueo.url = window.location.href;
  const marca = barraOcupaLugar()
    ? MARCA_SCROLL_BLOQUEADO.conBarra
    : MARCA_SCROLL_BLOQUEADO.sinBarra;
  document.documentElement.setAttribute(ATRIBUTO_SCROLL_BLOQUEADO, marca);
}

/**
 * Si algo movió la lista igual (un navegador que ignora el overflow), vuelve a
 * donde estaba. Con otra URL (un «atrás», un filtro) la posición guardada ya no
 * es de esta lista: queda el scroll que dejó el navegador.
 */
function restaurarPosicion() {
  if (window.location.href !== bloqueo.url) return;
  if (window.scrollY !== bloqueo.posicion) window.scrollTo({ top: bloqueo.posicion });
}

function liberar() {
  bloqueo.abiertos -= 1;
  if (bloqueo.abiertos > 0) return;
  document.documentElement.removeAttribute(ATRIBUTO_SCROLL_BLOQUEADO);
  restaurarPosicion();
}

/**
 * Mientras `activo`, arrastrar o girar la rueda sobre el fondo no mueve el
 * documento de atrás (#861). Solo toca `<html>`: el scroll dentro del diálogo,
 * y el `overscroll-behavior` de lo que scrollea adentro, siguen como estaban.
 */
export function useBloquearScroll(activo: boolean) {
  useLayoutEffect(() => {
    if (!activo) return;
    bloquear();
    return liberar;
  }, [activo]);
}
