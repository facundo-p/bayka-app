import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMatch } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CLAVE_STORAGE, guardarLocal, leerLocal } from '../lib/almacenamientoLocal';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarPlantaciones } from '../queries/plantationQueries';
import type { ResultadoBusqueda, ScopeBusqueda } from '../queries/buscarQueries';

/** Scope contextual: acota la búsqueda a la plantación en la que estás. */
export type ScopeContextual = ScopeBusqueda & { etiqueta: string };

type CommandMenuContexto = {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  scope: ScopeContextual | null;
  limpiarScope: () => void;
  recientes: ResultadoBusqueda[];
  registrarReciente: (resultado: ResultadoBusqueda) => void;
};

const Contexto = createContext<CommandMenuContexto | null>(null);

const TOPE_RECIENTES = 6;

/** ¿El foco está en un campo de texto editable? (no en el input de la paleta). */
function focoEnTexto(): boolean {
  const activo = document.activeElement as HTMLElement | null;
  if (!activo) return false;
  if (activo.isContentEditable) return true;
  const etiqueta = activo.tagName;
  return etiqueta === 'INPUT' || etiqueta === 'TEXTAREA';
}

function esAtajoComando(evento: KeyboardEvent): boolean {
  return (evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k';
}

/** Un JSON corrupto arranca vacío en vez de romper la paleta. */
function leerRecientes(): ResultadoBusqueda[] {
  const crudo = leerLocal(CLAVE_STORAGE.recientesCommandMenu);
  if (!crudo) return [];
  try {
    return JSON.parse(crudo) as ResultadoBusqueda[];
  } catch {
    return [];
  }
}

function guardarRecientes(recientes: ResultadoBusqueda[]): void {
  guardarLocal(CLAVE_STORAGE.recientesCommandMenu, JSON.stringify(recientes));
}

/** Estado abierto/cerrado + atajo global ⌘K (ignora foco en texto). */
function useAperturaPorAtajo() {
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (!esAtajoComando(evento)) return;
      if (focoEnTexto()) return;
      evento.preventDefault();
      setAbierto((previo) => !previo);
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, []);
  return { abierto, abrir, cerrar };
}

/** Scope derivado de la ruta `/plantaciones/:id`; etiqueta = lugar (de cache). */
function useScopeContextual(): ScopeContextual | null {
  const match = useMatch('/plantaciones/:id/*');
  const plantationId = match?.params.id;
  const { data } = useQuery({
    queryKey: CLAVE_QUERY.plantaciones(),
    queryFn: listarPlantaciones,
    enabled: Boolean(plantationId),
  });
  return useMemo(() => {
    if (!plantationId) return null;
    const lugar = data?.find((plantacion) => plantacion.id === plantationId)?.lugar ?? '';
    return { plantationId, etiqueta: lugar };
  }, [plantationId, data]);
}

function useRecientes() {
  const [recientes, setRecientes] = useState<ResultadoBusqueda[]>(leerRecientes);
  const registrarReciente = useCallback((resultado: ResultadoBusqueda) => {
    setRecientes((previos) => {
      const sinDuplicado = previos.filter((item) => item.id !== resultado.id);
      const actualizados = [resultado, ...sinDuplicado].slice(0, TOPE_RECIENTES);
      guardarRecientes(actualizados);
      return actualizados;
    });
  }, []);
  return { recientes, registrarReciente };
}

/** El scope quitado se reactiva al cambiar de plantación (otro id) o al reabrir. */
function useScopeQuitable(abierto: boolean) {
  const scopeContextual = useScopeContextual();
  const [scopeQuitado, setScopeQuitado] = useState<string | null>(null);
  useEffect(() => {
    if (abierto) setScopeQuitado(null);
  }, [abierto]);

  const scope =
    scopeContextual && scopeContextual.plantationId !== scopeQuitado ? scopeContextual : null;
  const limpiarScope = useCallback(
    () => setScopeQuitado(scopeContextual?.plantationId ?? null),
    [scopeContextual],
  );
  return { scope, limpiarScope };
}

export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const { abierto, abrir, cerrar } = useAperturaPorAtajo();
  const { scope, limpiarScope } = useScopeQuitable(abierto);
  const { recientes, registrarReciente } = useRecientes();
  const valor = useMemo(
    () => ({ abierto, abrir, cerrar, scope, limpiarScope, recientes, registrarReciente }),
    [abierto, abrir, cerrar, scope, limpiarScope, recientes, registrarReciente],
  );
  return createElement(Contexto.Provider, { value: valor }, children);
}

export function useCommandMenu(): CommandMenuContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCommandMenu debe usarse dentro de CommandMenuProvider');
  return contexto;
}
