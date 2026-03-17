export type Role = 'admin' | 'tecnico';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: Role;
  organizacionId: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}
