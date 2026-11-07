/** Sauvegarde locale d'une run en IndexedDB. */
import type { CardIndex, RunState } from '../../engine/index.ts';

/** À monter à chaque changement de forme de `RunState`, avec une migration. */
export const SAVE_VERSION = 1;

const DATABASE = 'combodex';
const STORE = 'saves';
const CURRENT_RUN = 'current-run';
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

/** Rend l'état d'une sauvegarde, ou `null` si elle est illisible ou d'un autre format. */
export function decodeSave(raw: unknown, index: CardIndex): RunState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { version, state } = raw as Partial<SaveFile>;
  if (version !== SAVE_VERSION || !state || !Array.isArray(state.deck)) return null;
  if (!PHASES.includes(state.phase)) return null;
  if (typeof state.rng?.state !== 'number') return null;
  const known = state.deck.every((card) => index.byId.has(card.cardId));
  return known ? state : null;
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

export function indexedDbStore(factory: IDBFactory = indexedDB): SaveStore {
  let database: Promise<IDBDatabase> | null = null;
  const connect = () => {
    database ??= openDatabase(factory);
    return database;
  };
  return {
    async read() {
      const db = await connect();
      const store = db.transaction(STORE, 'readonly').objectStore(STORE);
      return request(() => store.get(CURRENT_RUN));
    },
    async write(file) {
      const db = await connect();
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(file, CURRENT_RUN);
      await completed(transaction);
    },
    async clear() {
      const db = await connect();
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(CURRENT_RUN);
      await completed(transaction);
    },
  };
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
