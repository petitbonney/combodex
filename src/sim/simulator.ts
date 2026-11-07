/** Simulateur de runs : N runs jouées par le bot, agrégées pour l'équilibrage. */
import {
  applyAction,
  type CardIndex,
  COMBO_IDS,
  type ComboId,
  createRun,
  type OpponentKind,
  type RunState,
} from '../engine/index.ts';
import { chooseAction } from './bot.ts';

/** Garde-fou contre une boucle infinie du bot. */
const MAX_ACTIONS_PER_RUN = 5000;

export interface FightRecord {
  arena: number;
  kind: OpponentKind;
  won: boolean;
  bestHand: number;
}

export interface RunRecord {
  seed: number;
  won: boolean;
  fights: FightRecord[];
  bestHand: number;
  handsPlayed: number;
  money: number;
  toolCount: number;
  comboCounts: Partial<Record<string, number>>;
}

export function simulateRun(index: CardIndex, seed: number, arenaCount: number): RunRecord {
  let state: RunState = createRun(index, { seed, arenaCount });
  const fights: FightRecord[] = [];
  let currentBest = 0;
  for (let step = 0; step < MAX_ACTIONS_PER_RUN; step++) {
    if (state.phase === 'won' || state.phase === 'lost') {
      return {
        seed,
        won: state.phase === 'won',
        fights,
        bestHand: state.stats.bestHand,
        handsPlayed: state.stats.handsPlayed,
        money: state.money,
        toolCount: state.tools.length,
        comboCounts: state.stats.comboCounts,
      };
    }
    const fight = state.fight;
    const { state: next, events } = applyAction(state, chooseAction(state, index), index);
    for (const event of events) {
      if (event.type === 'handPlayed') currentBest = Math.max(currentBest, event.result.score);
      if ((event.type === 'fightWon' || event.type === 'fightLost') && fight) {
        fights.push({
          arena: state.arenaIndex,
          kind: fight.opponent.kind,
          won: event.type === 'fightWon',
          bestHand: currentBest,
        });
        currentBest = 0;
      }
    }
    state = next;
  }
  throw new Error(`Run ${seed} : plus de ${MAX_ACTIONS_PER_RUN} actions`);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export interface ArenaReport {
  arena: number;
  reached: number;
  cleared: number;
}

export interface FightReport {
  arena: number;
  kind: OpponentKind;
  runs: number;
  won: number;
  medianBest: number;
}

export interface SimulationReport {
  runs: number;
  seed: number;
  arenas: number;
  won: number;
  arenaReports: ArenaReport[];
  fightReports: FightReport[];
  medianBest: number;
  bestRecord: number;
  medianHands: number;
  medianMoney: number;
  medianTools: number;
  comboShares: { combo: ComboId; share: number }[];
}

export function simulate(
  index: CardIndex,
  runs: number,
  seed: number,
  arenas: number,
): SimulationReport {
  const records = Array.from({ length: runs }, (_, offset) =>
    simulateRun(index, seed + offset, arenas),
  );
  const kinds: OpponentKind[] = ['trainer', 'elite', 'champion'];
  const fightReports: FightReport[] = [];
  const arenaReports: ArenaReport[] = [];
  for (let arena = 0; arena < arenas; arena++) {
    const inArena = records.filter((record) =>
      record.fights.some((fight) => fight.arena === arena),
    );
    const cleared = inArena.filter((record) =>
      record.fights.some(
        (fight) => fight.arena === arena && fight.kind === 'champion' && fight.won,
      ),
    );
    arenaReports.push({ arena, reached: inArena.length, cleared: cleared.length });
    for (const kind of kinds) {
      const fights = records.flatMap((record) =>
        record.fights.filter((fight) => fight.arena === arena && fight.kind === kind),
      );
      fightReports.push({
        arena,
        kind,
        runs: fights.length,
        won: fights.filter((fight) => fight.won).length,
        medianBest: median(fights.map((fight) => fight.bestHand)),
      });
    }
  }
  const comboTotals = COMBO_IDS.map((combo) => ({
    combo,
    total: records.reduce((sum, record) => sum + (record.comboCounts[combo] ?? 0), 0),
  }));
  const allHands = comboTotals.reduce((sum, { total }) => sum + total, 0);
  return {
    runs,
    seed,
    arenas,
    won: records.filter((record) => record.won).length,
    arenaReports,
    fightReports,
    medianBest: median(records.map((record) => record.bestHand)),
    bestRecord: Math.max(0, ...records.map((record) => record.bestHand)),
    medianHands: median(records.map((record) => record.handsPlayed)),
    medianMoney: median(records.map((record) => record.money)),
    medianTools: median(records.map((record) => record.toolCount)),
    comboShares: comboTotals.map(({ combo, total }) => ({
      combo,
      share: allHands === 0 ? 0 : total / allHands,
    })),
  };
}
