/** Logger con prefijo de dominio: facilita grep, mock en tests y filtrado. */
export function createTaggedLogger(tag: string) {
  const prefix = `[${tag}]`;
  return {
    info: (msg: string, ...args: any[]) => console.log(`${prefix} ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`${prefix} ${msg}`, ...args),
  };
}
