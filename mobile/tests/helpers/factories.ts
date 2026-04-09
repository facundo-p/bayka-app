// Typed test data factories for integration tests
// All IDs use crypto.randomUUID() for uniqueness per test

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'test-' + Math.random().toString(36).substring(2, 18);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---- Plantation ----

export type NewPlantation = {
  id: string;
  organizacionId: string;
  lugar: string;
  periodo: string;
  estado: string;
  creadoPor: string;
  createdAt: string;
  pendingSync: boolean;
};

export function createTestPlantation(overrides?: Partial<NewPlantation>): NewPlantation {
  return {
    id: randomId(),
    organizacionId: '00000000-0000-0000-0000-000000000001',
    lugar: 'Campo Norte',
    periodo: '2026-otono',
    estado: 'activa',
    creadoPor: 'user-admin-1',
    createdAt: nowIso(),
    pendingSync: false,
    ...overrides,
  };
}

// ---- SubGroup ----

export type NewSubgroup = {
  id: string;
  plantacionId: string;
  nombre: string;
  codigo: string;
  tipo: string;
  estado: string;
  usuarioCreador: string;
  createdAt: string;
};

export function createTestSubGroup(overrides?: Partial<NewSubgroup>): NewSubgroup {
  return {
    id: randomId(),
    plantacionId: 'plantation-default',
    nombre: 'Linea A',
    codigo: 'LA',
    tipo: 'linea',
    estado: 'activa',
    usuarioCreador: 'user-tecnico-1',
    createdAt: nowIso(),
    ...overrides,
  };
}

// ---- Tree ----

export type NewTree = {
  id: string;
  subgrupoId: string;
  especieId: string | null;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  plantacionId: number | null;
  globalId: string | null;
  usuarioRegistro: string;
  createdAt: string;
};

export function createTestTree(overrides?: Partial<NewTree>): NewTree {
  return {
    id: randomId(),
    subgrupoId: 'sg-default',
    especieId: 'species-eucalyptus',
    posicion: 1,
    subId: 'LA-EUC-1',
    fotoUrl: null,
    plantacionId: null,
    globalId: null,
    usuarioRegistro: 'user-tecnico-1',
    createdAt: nowIso(),
    ...overrides,
  };
}

// ---- Species ----

export type NewSpecies = {
  id: string;
  nombre: string;
  codigo: string;
  nombreCientifico: string | null;
  createdAt: string;
};

export function createTestSpecies(overrides?: Partial<NewSpecies>): NewSpecies {
  return {
    id: randomId(),
    nombre: 'Eucalyptus',
    codigo: 'EUC',
    nombreCientifico: null,
    createdAt: nowIso(),
    ...overrides,
  };
}
