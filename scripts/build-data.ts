/**
 * TCGdex -> data/sm12.json.
 *
 * Les fichiers du dépôt `tcgdex/cards-database` sont des données téléchargées : ils ne sont
 * jamais exécutés. On les lit avec l'API du compilateur TypeScript et on convertit l'objet
 * littéral en valeur JavaScript en parcourant l'arbre syntaxique.
 *
 * Le dépôt ne donne ni les prix ni, pour Éclipse Cosmique, les variantes. `--market` les relève
 * sur l'API REST et les fige dans data/sm12-market.json, versionné ; un build ordinaire ne
 * touche pas au réseau de TCGdex.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { ABILITY_CORRECTIONS } from '../src/content/ability-corrections.ts';
import { classifyAbility } from '../src/content/ability-families.ts';
import type {
  AbilityFamily,
  CardData,
  CardSet,
  LocalizedText,
  PokemonType,
  Rarity,
  Stage,
  Variant,
} from '../src/engine/cards.ts';

const REPOSITORY = 'https://github.com/tcgdex/cards-database.git';
const PINNED_COMMIT = 'a8fe5736aef9bd6be2436e3be730109030f4c6e2';
const VENDOR_DIR = 'vendor/cards-database';
const SERIES_DIR = 'data/Sun & Moon';
const SET_DIR = join(VENDOR_DIR, SERIES_DIR, 'Cosmic Eclipse');
const SET_ID = 'sm12';
const OUTPUT_FILE = `data/${SET_ID}.json`;
const MARKET_FILE = `data/${SET_ID}-market.json`;
const API_BASE = 'https://api.tcgdex.net/v2/en/cards';

/** Dégâts d'une carte sans attaque chiffrée. */
const DEFAULT_DAMAGE = 20;

/** Cartes écartées à la main ; vide pour Éclipse Cosmique. */
const EXCLUDED_CARDS: readonly string[] = [];

/** Variantes de repli quand le relevé de marché ne connaît pas la carte. */
const FALLBACK_VARIANTS: Record<Rarity, Variant[]> = {
  Common: ['normal', 'reverse'],
  Uncommon: ['normal', 'reverse'],
  Rare: ['normal', 'reverse'],
  'Ultra Rare': ['holo'],
  'Secret Rare': ['holo'],
};

interface MarketEntry {
  price: number | null;
  variants: Variant[];
}
type MarketData = Record<string, MarketEntry>;

type RawValue = string | number | boolean | null | undefined | RawValue[] | RawObject;
interface RawObject {
  [key: string]: RawValue;
}

function git(...args: string[]): void {
  execFileSync('git', ['-C', VENDOR_DIR, ...args], { stdio: 'inherit' });
}

function ensureVendor(): void {
  if (!existsSync(VENDOR_DIR)) {
    execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout', REPOSITORY, VENDOR_DIR], {
      stdio: 'inherit',
    });
  }
  git('sparse-checkout', 'set', SERIES_DIR);
  try {
    git('checkout', '--quiet', PINNED_COMMIT);
  } catch {
    git('fetch', '--quiet', 'origin');
    git('checkout', '--quiet', PINNED_COMMIT);
  }
}

/** Convertit un nœud de l'arbre en valeur ; les identifiants (`Set`) deviennent `undefined`. */
function toValue(node: ts.Expression): RawValue {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node)) return undefined;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    return -Number((node.operand as ts.NumericLiteral).text);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(toValue);
  if (ts.isObjectLiteralExpression(node)) {
    const result: RawObject = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = property.name;
      if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
        result[name.text] = toValue(property.initializer);
      }
    }
    return result;
  }
  throw new Error(`Nœud inattendu : ${ts.SyntaxKind[node.kind]}`);
}

function readCardFile(path: string): RawObject {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const initializer = statement.declarationList.declarations[0]?.initializer;
    if (initializer && ts.isObjectLiteralExpression(initializer)) {
      return toValue(initializer) as RawObject;
    }
  }
  throw new Error(`Aucun objet carte dans ${path}`);
}

function localized(value: RawValue): LocalizedText {
  const text = value as { fr?: string; en?: string };
  const en = text.en ?? '';
  return { fr: text.fr ?? en, en };
}

/** « 30+ » et « 50× » gardent leur nombre ; une carte sans attaque chiffrée vaut 20. */
function bestDamage(attacks: RawObject[]): number {
  const values = attacks.map((attack) => Number.parseInt(String(attack.damage ?? ''), 10));
  const best = Math.max(0, ...values.filter(Number.isFinite));
  return best > 0 ? best : DEFAULT_DAMAGE;
}

function typeList(entries: RawValue): PokemonType[] {
  return ((entries as RawObject[] | undefined) ?? []).map((entry) => entry.type as PokemonType);
}

interface ClassifiedAbility {
  family: AbilityFamily;
  recognized: boolean;
  corrected: boolean;
  agrees: boolean;
}

function classify(cardId: string, effect: LocalizedText): ClassifiedAbility {
  const french = classifyAbility(effect.fr, 'fr');
  const english = classifyAbility(effect.en, 'en');
  const correction = ABILITY_CORRECTIONS[cardId];
  return {
    family: correction ?? french ?? 'generic',
    recognized: french !== null,
    corrected: correction !== undefined,
    agrees: french === english,
  };
}

function toCard(raw: RawObject, localId: string, market: MarketData): CardData | null {
  const id = `${SET_ID}-${localId}`;
  const attacks = (raw.attacks as RawObject[] | undefined) ?? [];
  if (raw.category !== 'Pokemon' || attacks.length === 0 || EXCLUDED_CARDS.includes(id)) {
    return null;
  }
  const rarity = raw.rarity as Rarity;
  const rawAbility = (raw.abilities as RawObject[] | undefined)?.[0];
  const ability = rawAbility
    ? { name: localized(rawAbility.name), effect: localized(rawAbility.effect) }
    : null;
  const dexIds = (raw.dexId as number[] | undefined) ?? [];
  const thirdParty = raw.thirdParty as { cardmarket?: number } | undefined;
  const entry = market[id];
  return {
    id,
    localId,
    name: localized(raw.name),
    dexIds,
    types: (raw.types as PokemonType[]) ?? [],
    stage: (raw.stage as Stage | undefined) ?? 'Basic',
    evolveFrom: (raw.evolveFrom as { en?: string } | undefined)?.en ?? null,
    hp: Number(raw.hp ?? 0),
    retreat: Number(raw.retreat ?? 0),
    bestDamage: bestDamage(attacks),
    weaknesses: typeList(raw.weaknesses),
    resistances: typeList(raw.resistances),
    rarity,
    variants: entry?.variants ?? FALLBACK_VARIANTS[rarity],
    illustrator: (raw.illustrator as string | undefined) ?? null,
    abilityFamily: ability ? classify(id, ability.effect).family : null,
    ability,
    isTagTeam: String(raw.suffix ?? '').startsWith('TAG TEAM'),
    cardmarketId: thirdParty?.cardmarket ?? null,
    cardmarketPrice: entry?.price ?? null,
  };
}

/** Les GX évolués n'ont pas de champ `stage` : on le déduit de leur pré-évolution. */
function inferMissingStages(cards: CardData[]): void {
  for (const card of cards) {
    if (card.evolveFrom === null || card.stage !== 'Basic') continue;
    const parent = cards.find((other) => other.name.en === card.evolveFrom);
    card.stage = parent?.stage === 'Stage1' ? 'Stage2' : 'Stage1';
  }
}

function cardFiles(): { localId: string; path: string }[] {
  return readdirSync(SET_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({ localId: file.slice(0, -3), path: join(SET_DIR, file) }))
    .sort((a, b) => a.localId.localeCompare(b.localId, 'en', { numeric: true }));
}

/** Les clés de prix TCGplayer disent quelles impressions existent vraiment. */
function variantsFromPricing(tcgplayer: Record<string, unknown> | undefined): Variant[] {
  const variants: Variant[] = [];
  if (tcgplayer?.normal) variants.push('normal');
  if (tcgplayer?.['reverse-holofoil']) variants.push('reverse');
  if (tcgplayer?.holofoil) variants.push('holo');
  if (tcgplayer?.['1st-edition'] || tcgplayer?.['1st-edition-holofoil']) {
    variants.push('firstEdition');
  }
  return variants;
}

async function refreshMarket(localIds: string[]): Promise<void> {
  const market: MarketData = {};
  for (const localId of localIds) {
    const id = `${SET_ID}-${localId}`;
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error(`${id} : HTTP ${response.status}`);
    const card = (await response.json()) as {
      category: string;
      pricing?: {
        cardmarket?: { trend?: number | null } | null;
        tcgplayer?: Record<string, unknown>;
      };
    };
    if (card.category !== 'Pokemon') continue;
    const variants = variantsFromPricing(card.pricing?.tcgplayer);
    if (variants.length === 0) continue;
    market[id] = { price: card.pricing?.cardmarket?.trend ?? null, variants };
  }
  writeFileSync(MARKET_FILE, `${JSON.stringify(market, null, 1)}\n`);
  console.log(`Relevé de marché : ${Object.keys(market).length} cartes dans ${MARKET_FILE}`);
}

function readSetName(): LocalizedText {
  const path = join(VENDOR_DIR, SERIES_DIR, 'Cosmic Eclipse.ts');
  return localized(readCardFile(path).name);
}

function reportAbilities(cards: CardData[]): void {
  const withAbility = cards.filter((card) => card.ability);
  const results = withAbility.map((card) =>
    classify(card.id, (card.ability as { effect: LocalizedText }).effect),
  );
  const count = (predicate: (result: ClassifiedAbility) => boolean) =>
    results.filter(predicate).length;
  const percent = (value: number) => `${Math.round((value / results.length) * 100)} %`;
  const recognized = count((result) => result.recognized);
  const agrees = count((result) => result.agrees);
  console.log(`Talents : ${results.length}`);
  console.log(`  reconnus par mots-clés : ${recognized} (${percent(recognized)})`);
  console.log(`  même famille en fr et en : ${agrees} (${percent(agrees)})`);
  console.log(`  corrigés à la main : ${count((result) => result.corrected)}`);
  const families = new Map<AbilityFamily, number>();
  for (const result of results) {
    families.set(result.family, (families.get(result.family) ?? 0) + 1);
  }
  const summary = [...families].sort((a, b) => b[1] - a[1]);
  console.log(`  familles : ${summary.map(([family, n]) => `${family} ${n}`).join(', ')}`);
}

async function main(): Promise<void> {
  ensureVendor();
  const files = cardFiles();
  if (process.argv.includes('--market')) {
    await refreshMarket(files.map((file) => file.localId));
  }
  const market: MarketData = existsSync(MARKET_FILE)
    ? JSON.parse(readFileSync(MARKET_FILE, 'utf8'))
    : {};
  const cards = files
    .map((file) => toCard(readCardFile(file.path), file.localId, market))
    .filter((card) => card !== null);
  inferMissingStages(cards);
  const set: CardSet = {
    id: SET_ID,
    name: readSetName(),
    sourceCommit: PINNED_COMMIT,
    cards,
  };
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(set, null, 1)}\n`);
  console.log(`${cards.length} cartes écrites dans ${OUTPUT_FILE}`);
  reportAbilities(cards);
}

await main();
