/**
 * Code de run partageable : extension, graine, Outils verrouillés et lignées du deck custom tiennent
 * dans 12 caractères, pour qu'une run se rejoue à l'identique sur un autre appareil.
 */
import { LOCKABLE_TOOLS } from '../content/objectives.ts';
import { SETS } from '../content/sets.ts';
import type { ToolId } from '../content/tools.ts';

export interface RunCode {
  setId: string;
  seed: number;
  lockedTools: ToolId[];
  starterLines: number[] | null;
}

/** Base 32 sans I, L, O ni U, faciles à confondre. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;
const SEED_BITS = 32n;
const SET_BITS = 4n;
const LOCK_BITS = 10n;
const LINE_BITS = 5n;
const CHECK_BITS = 4n;

function mask(bits: bigint): bigint {
  return (1n << bits) - 1n;
}

/** Quatre bits de contrôle, pour refuser un code mal recopié. */
function checksum(payload: bigint): bigint {
  let sum = 0n;
  for (let rest = payload; rest > 0n; rest >>= CHECK_BITS)
    sum = sum * 3n + (rest & mask(CHECK_BITS));
  return sum & mask(CHECK_BITS);
}

function pack(code: RunCode): bigint {
  const set = SETS.findIndex((entry) => entry.id === code.setId);
  if (set < 0) throw new Error(`Extension inconnue : ${code.setId}`);
  const locks = LOCKABLE_TOOLS.reduce(
    (bits, tool, position) =>
      code.lockedTools.includes(tool) ? bits | (1n << BigInt(position)) : bits,
    0n,
  );
  const [first, second] = code.starterLines ?? [];
  // 0 : pas de lignée choisie.
  const line = (value: number | undefined) => BigInt(value === undefined ? 0 : value + 1);
  let payload = BigInt(code.seed >>> 0);
  payload = (payload << SET_BITS) | BigInt(set);
  payload = (payload << LOCK_BITS) | locks;
  payload = (payload << LINE_BITS) | line(first);
  return (payload << LINE_BITS) | line(second);
}

export function encodeRunCode(code: RunCode): string {
  const payload = pack(code);
  let value = (payload << CHECK_BITS) | checksum(payload);
  let text = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    text = (ALPHABET[Number(value & 31n)] as string) + text;
    value >>= 5n;
  }
  return `${text.slice(0, 4)}-${text.slice(4, 8)}-${text.slice(8)}`;
}

/** Rend le contenu d'un code, ou `null` s'il n'en est pas un. */
export function decodeRunCode(text: string): RunCode | null {
  const clean = text.replaceAll('-', '').replaceAll(' ', '').toUpperCase();
  if (clean.length !== CODE_LENGTH) return null;
  let value = 0n;
  for (const char of clean) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = (value << 5n) | BigInt(digit);
  }
  const payload = value >> CHECK_BITS;
  if ((value & mask(CHECK_BITS)) !== checksum(payload)) return null;
  const second = Number(payload & mask(LINE_BITS));
  const first = Number((payload >> LINE_BITS) & mask(LINE_BITS));
  const locks = (payload >> (2n * LINE_BITS)) & mask(LOCK_BITS);
  const setIndex = Number((payload >> (2n * LINE_BITS + LOCK_BITS)) & mask(SET_BITS));
  const seed = Number((payload >> (2n * LINE_BITS + LOCK_BITS + SET_BITS)) & mask(SEED_BITS));
  const set = SETS[setIndex];
  if (!set) return null;
  return {
    setId: set.id,
    seed,
    lockedTools: LOCKABLE_TOOLS.filter((_, position) => (locks >> BigInt(position)) & 1n),
    starterLines: first > 0 && second > 0 ? [first - 1, second - 1] : null,
  };
}
