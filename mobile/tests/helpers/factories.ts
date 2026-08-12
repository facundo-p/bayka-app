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
  // Opcional: si no se pasa, aplica el default del schema (visible).
  visibleInApp?: boolean;
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

// ---- Group ----

export type NewGroup = {
  id: string;
  plantacionId: string;
  // Parcela obligatoria (#90): el schema la exige NOT NULL.
  parcelaId: string;
  nombre: string;
  codigo: string;
  tipo: string;
  estado: string;
  usuarioCreador: string;
  createdAt: string;
};

export function createTestGroup(overrides?: Partial<NewGroup>): NewGroup {
  return {
    id: randomId(),
    plantacionId: 'plantation-default',
    parcelaId: 'parcela-default',
    nombre: 'Linea A',
    codigo: 'LA',
    tipo: 'linea',
    estado: 'activa',
    usuarioCreador: 'user-tecnico-1',
    createdAt: nowIso(),
    ...overrides,
  };
}

// ---- Parcela ----

export type NewParcela = {
  id: string;
  plantacionId: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export function createTestParcela(overrides?: Partial<NewParcela>): NewParcela {
  return {
    id: randomId(),
    plantacionId: 'plantation-default',
    nombre: 'Parcela 1',
    codigo: 'P1',
    descripcion: null,
    pendingSync: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...overrides,
  };
}

// ---- Tree ----

export type NewTree = {
  id: string;
  groupId: string;
  especieId: string | null;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  plantacionId: number | null;
  globalId: number | null;
  usuarioRegistro: string;
  createdAt: string;
};

export function createTestTree(overrides?: Partial<NewTree>): NewTree {
  return {
    id: randomId(),
    groupId: 'sg-default',
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
