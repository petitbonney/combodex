/** Sauvegarde locale de la run en cours et de la progression, en IndexedDB. */
import { TOOL_SLOTS } from '../../content/balance.ts';
import { LOCKABLE_TOOLS } from '../../content/objectives.ts';
import { STARTING_SET } from '../../content/sets.ts';
import { type CardIndex, emptyMeta, type MetaState, type RunState } from '../../engine/index.ts';

/** À monter à chaque changement de forme de `RunState`, avec une migration. */
export const SAVE_VERSION = 2;

const DATABASE = 'combodex';
const STORE = 'saves';
const CURRENT_RUN = 'current-run';
const META = 'meta';
const PHASES = ['intro', 'fight', 'shop', 'booster'];

export interface SaveFile {
  version: number;
  savedAt: number;
  state: RunState;
}

export interface SaveStore {
  read(): Promise<unknown>;
  write(file: SaveFile): Promise<void>;
  clear(): Promise<void>;
}

export function encodeSave(state: RunState, savedAt: number): SaveFile {
  return { version: SAVE_VERSION, savedAt, state };
}

/** Une run de la tranche verticale : 3 Arènes sur Éclipse Cosmique, sans consommable ni Ligue. */
function migrateFromV1(state: RunState): RunState {
  const { fight, shop, stats } = state;
  return {
    ...state,
    setId: STARTING_SET,
    lockedTools: [...LOCKABLE_TOOLS],
    starterLines: null,
    dailyDate: null,
    toolSlots: TOOL_SLOTS,
    aceSpec: null,
    arenaCenterUsed: false,
    fight: fight && { ...fight, handBonus: 0 },
    shop: shop && { ...shop, consumable: null },
    stats: { ...stats, championsBeaten: state.arenaIndex },
  };
}

/** Rend l'état d'une sauvegarde, ou `null` si elle est illisible ou d'un autre format. */
export function decodeSave(raw: unknown, indexFor: (setId: string) => CardIndex): RunState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { version, state: saved } = raw as Partial<SaveFile>;
  if ((version !== SAVE_VERSION && version !== 1) || !saved || !Array.isArray(saved.deck)) {
    return null;
  }
  if (!PHASES.includes(saved.phase)) return null;
  if (typeof saved.rng?.state !== 'number') return null;
  const state = version === 1 ? migrateFromV1(saved) : saved;
  const index = indexFor(state.setId);
  const known = state.deck.every((card) => index.byId.has(card.cardId));
  return known ? state : null;
}

/** Rend une progression lisible, complétée de ce qui lui manque ; vide si elle est illisible. */
export function decodeMeta(raw: unknown): MetaState {
  const empty = emptyMeta();
  if (typeof raw !== 'object' || raw === null) return empty;
  const meta = raw as Partial<MetaState>;
  return {
    seen: meta.seen ?? empty.seen,
    records: { ...empty.records, ...meta.records },
    objectives: meta.objectives ?? empty.objectives,
    daily: meta.daily ?? empty.daily,
  };
}

function request<T>(open: () => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const pending = open();
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () => reject(pending.error);
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
}

/** Une écriture n'est finie que lorsque sa transaction est validée. */
function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function entryStore(factory: IDBFactory, key: string) {
  let database: Promise<IDBDatabase> | null = null;
  const connect = () => {
    database ??= openDatabase(factory);
    return database;
  };
  return {
    async read(): Promise<unknown> {
      const db = await connect();
      const store = db.transaction(STORE, 'readonly').objectStore(STORE);
      return request(() => store.get(key));
    },
    async write(value: unknown): Promise<void> {
      const db = await connect();
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(value, key);
      await completed(transaction);
    },
    async clear(): Promise<void> {
      const db = await connect();
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(key);
      await completed(transaction);
    },
  };
}

export function indexedDbStore(factory: IDBFactory = indexedDB): SaveStore {
  return entryStore(factory, CURRENT_RUN);
}

export interface MetaStore {
  read(): Promise<unknown>;
  write(meta: MetaState): Promise<void>;
}

export function indexedDbMetaStore(factory: IDBFactory = indexedDB): MetaStore {
  return entryStore(factory, META);
}

/** Stockage de repli, sans persistance, quand IndexedDB est indisponible. */
export function memoryStore(): SaveStore {
  let file: SaveFile | null = null;
  return {
    read: async () => file,
    write: async (next) => {
      file = next;
    },
    clear: async () => {
      file = null;
    },
  };
}

/** Progression de repli, sans persistance. */
export function memoryMetaStore(): MetaStore {
  let meta: MetaState | null = null;
  return {
    read: async () => meta,
    write: async (next) => {
      meta = next;
    },
  };
}
