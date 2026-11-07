/** `npm run sim -- --runs=1000 --seed=1 --set=sm12 --lang=fr` */
import { parseArgs } from 'node:util';
import { DEFAULT_ARENA_COUNT } from '../content/balance.ts';
import { type Language, messagesFor } from '../content/i18n/index.ts';
import { LOCKABLE_TOOLS } from '../content/objectives.ts';
import { STARTING_SET } from '../content/sets.ts';
import { loadCards } from '../data.ts';
import { simulate } from './simulator.ts';

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '1' },
    arenas: { type: 'string', default: String(DEFAULT_ARENA_COUNT) },
    lang: { type: 'string', default: 'fr' },
    set: { type: 'string', default: STARTING_SET },
    // Par défaut, les Outils à débloquer restent absents, comme pour un nouveau joueur.
    unlocked: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
});

function integerOption(name: 'runs' | 'seed' | 'arenas'): number {
  const value = Number(values[name]);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} : entier attendu`);
  return value;
}

const start = performance.now();
const report = simulate(
  loadCards(values.set),
  integerOption('runs'),
  integerOption('seed'),
  integerOption('arenas'),
  values.unlocked ? [] : LOCKABLE_TOOLS,
);
const seconds = ((performance.now() - start) / 1000).toFixed(1);

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const { sim, opponents, combos } = messagesFor(values.lang as Language);
  const percent = (value: number, total: number) =>
    total === 0 ? '—' : `${((value / total) * 100).toFixed(1)} %`;
  console.log(sim.header(report.runs, report.seed, report.arenas));
  console.log(sim.winRate(percent(report.won, report.runs)));
  console.log(sim.arenaHeader);
  for (const { arena, reached, cleared } of report.arenaReports) {
    console.log(
      sim.arenaRow(
        arena + 1,
        percent(reached, report.runs),
        percent(cleared, report.runs),
        percent(cleared, reached),
      ),
    );
  }
  console.log(sim.fightHeader);
  for (const fight of report.fightReports) {
    const name = `${fight.arena + 1} ${opponents[fight.kind]}`;
    console.log(sim.fightRow(name, fight.runs, percent(fight.won, fight.runs), fight.medianBest));
  }
  console.log(sim.medianBest(report.medianBest));
  console.log(sim.bestHandRecord(report.bestRecord));
  console.log(sim.medianHands(report.medianHands));
  console.log(sim.medianMoney(report.medianMoney));
  console.log(sim.medianTools(report.medianTools));
  console.log(sim.comboHeader);
  for (const { combo, share } of report.comboShares) {
    console.log(sim.comboRow(combos[combo], percent(share, 1)));
  }
  console.log(sim.elapsed(seconds));
}
