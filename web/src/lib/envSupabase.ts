/**
 * Coherencia del par VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 *
 * Las `VITE_*` se hornean en build time, así que un valor mal cargado en el
 * hosting no se nota hasta que Supabase responde `401 Invalid API key` al
 * loguearse. Esto corre en el build (vite.config.ts) para que un build mal
 * configurado no llegue a deployarse. Sin globals de Vite a propósito:
 * importable desde la config y testeable.
 */

export type Diagnostico = { nivel: 'error' | 'aviso'; mensaje: string };

/** El `ref` identifica al proyecto y también viaja dentro de la anon key:
 *  si no coinciden, Supabase responde 401 sin decir cuál de los dos está mal. */
const HOST_PROYECTO = /^([a-z0-9]+)\.supabase\.co$/;
const SEGMENTOS_JWT = 3;
/** Un HMAC-SHA256 son 32 bytes: 43 caracteres en base64url sin padding. */
const LARGO_FIRMA = 43;
const ROL_ANON = 'anon';
/** API keys del formato nuevo de Supabase, que no son JWT. */
const PREFIJO_PUBLICA = 'sb_publishable_';
const PREFIJO_SECRETA = 'sb_secret_';

type Claims = { ref: string; role: string };

const error = (mensaje: string): Diagnostico => ({ nivel: 'error', mensaje });
const aviso = (mensaje: string): Diagnostico => ({ nivel: 'aviso', mensaje });

const NO_ES_JWT = error(
  'VITE_SUPABASE_ANON_KEY no tiene forma de JWT: revisá que el valor no tenga texto pegado ' +
    '(p.ej. el nombre de la variable) ni le falten caracteres.',
);

function decodificar(segmento: string): unknown {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
}

/** El `ref` del proyecto hosteado, o un aviso si la URL no es de uno (dev
 *  local, self-hosted): ahí no hay `ref` contra el cual cruzar la key. */
function refDeLaUrl(url: string): { ref?: string; diagnostico?: Diagnostico } {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return { diagnostico: error(`VITE_SUPABASE_URL no es una URL válida (recibido: "${url}").`) };
  }
  const ref = HOST_PROYECTO.exec(host)?.[1];
  if (!ref) {
    return {
      diagnostico: aviso(
        `VITE_SUPABASE_URL apunta a "${host}", que no es un proyecto <ref>.supabase.co: ` +
          'no se puede verificar que la anon key sea de ese proyecto.',
      ),
    };
  }
  return { ref };
}

/** Los claims de un JWT bien formado, o undefined si el valor no lo es.
 *  Decodifica también el header: el texto pegado adelante rompe ahí, no en el
 *  payload, que queda intacto y pasaría el resto de los chequeos. */
function claimsDelJwt(segmentos: string[]): Claims | undefined {
  try {
    const header = decodificar(segmentos[0]);
    if (typeof header !== 'object' || header === null) return undefined;
    const { ref, role } = decodificar(segmentos[1]) as Partial<Claims>;
    if (typeof ref !== 'string' || typeof role !== 'string') return undefined;
    return { ref, role };
  } catch {
    return undefined;
  }
}

/** Los claims de una anon key legacy. Las del formato nuevo no son JWT y no
 *  dejan verificar nada del lado del build. */
function claimsDeLaKey(anonKey: string): { claims?: Claims; diagnostico?: Diagnostico } {
  if (anonKey.startsWith(PREFIJO_SECRETA)) {
    return {
      diagnostico: error('VITE_SUPABASE_ANON_KEY es una secret key: no puede ir al front.'),
    };
  }
  if (anonKey.startsWith(PREFIJO_PUBLICA)) {
    return {
      diagnostico: aviso(
        'VITE_SUPABASE_ANON_KEY usa el formato nuevo de Supabase: no lleva el proyecto adentro, ' +
          'así que no se puede verificar que coincida con VITE_SUPABASE_URL.',
      ),
    };
  }
  const segmentos = anonKey.split('.');
  if (segmentos.length !== SEGMENTOS_JWT) return { diagnostico: NO_ES_JWT };
  const claims = claimsDelJwt(segmentos);
  if (!claims) return { diagnostico: NO_ES_JWT };
  if (segmentos[2].length !== LARGO_FIRMA) {
    return {
      diagnostico: error(
        `La firma de VITE_SUPABASE_ANON_KEY mide ${segmentos[2].length} caracteres en vez de ` +
          `${LARGO_FIRMA}: la key está truncada o tiene texto pegado al final.`,
      ),
    };
  }
  return { claims };
}

/** Diagnostica el par de variables. Sin errores, el build puede seguir. */
export function diagnosticarEnvSupabase(url: unknown, anonKey: unknown): Diagnostico[] {
  if (typeof url !== 'string' || !url || typeof anonKey !== 'string' || !anonKey) {
    return [
      error(
        'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: copiá web/.env.example a web/.env.',
      ),
    ];
  }

  const { ref, diagnostico: dUrl } = refDeLaUrl(url);
  const { claims, diagnostico: dKey } = claimsDeLaKey(anonKey);
  const diagnosticos = [dUrl, dKey].filter((d) => d !== undefined);
  if (!claims) return diagnosticos;

  if (ref && claims.ref !== ref) {
    diagnosticos.push(
      error(
        `VITE_SUPABASE_ANON_KEY es del proyecto "${claims.ref}" pero VITE_SUPABASE_URL apunta a ` +
          `"${ref}". Supabase responde 401 Invalid API key ante esta combinación.`,
      ),
    );
  }
  if (claims.role !== ROL_ANON) {
    diagnosticos.push(
      error(`VITE_SUPABASE_ANON_KEY tiene role "${claims.role}": esa key no puede ir al front.`),
    );
  }
  return diagnosticos;
}
