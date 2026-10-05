import { crearPreferenciaBooleana } from './preferencia';

/** Preferencia global (todos los grupos) de listar los árboles de N a 1. Persistida como booleano. */
export const preferenciaOrdenDescendente = crearPreferenciaBooleana({
  clave: 'orden_arboles_descendente',
  porDefecto: false,
});
