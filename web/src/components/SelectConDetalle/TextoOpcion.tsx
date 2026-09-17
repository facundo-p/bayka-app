import type { OpcionConDetalle } from './opcionesConDetalle';

interface TextoOpcionProps {
  opcion: OpcionConDetalle;
  clasePrincipal: string;
  claseSecundario: string;
}

export function TextoOpcion({ opcion, clasePrincipal, claseSecundario }: TextoOpcionProps) {
  // El espacio entre renglones separa nombre y detalle en el nombre accesible.
  return (
    <>
      <span className={clasePrincipal}>{opcion.principal}</span>
      {opcion.secundario && (
        <>
          {' '}
          <span className={claseSecundario}>{opcion.secundario}</span>
        </>
      )}
    </>
  );
}
