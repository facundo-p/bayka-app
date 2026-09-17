/** Roles de usuario — contrato con contracts/roles.json (fuente de verdad; runtime y contrato cambian juntos). */
export const ROL = {
  admin: 'admin',
  tecnico: 'tecnico',
  superadmin: 'superadmin',
} as const;

export type Rol = (typeof ROL)[keyof typeof ROL];
