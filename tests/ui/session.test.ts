import { describe, expect, it, vi } from 'vitest';
import { messagesFor } from '../../src/content/i18n/index.ts';
import { chooseAction } from '../../src/sim/bot.ts';
import { cardIndex } from '../../src/ui/logic/data.ts';
import { memoryStore, type SaveFile } from '../../src/ui/logic/save.ts';
import { Session, type SessionView } from '../../src/ui/logic/session.ts';

function newSession(store = memoryStore()) {
  const session = new Session({
    index: cardIndex,
    store,
    speed: () => 1000,
    texts: () => ({ language: 'fr', text: messagesFor('fr') }),
  });
  let view!: SessionView;
  session.subscribe((value) => {
    view = value;
  });
  return { session, store, view: () => view };
}

/** Joue une action en fermant les écrans de gains dès qu'ils s'affichent. */
async function act(
  session: Session,
  view: () => SessionView,
  action: Parameters<Session['dispatch']>[0],
) {
  const done = session.dispatch(action);
  const ticker = setInterval(() => {
    if (view().stage.beat?.kind === 'gains') session.skip();
  }, 1);
  const reason = await done;
  clearInterval(ticker);
  return reason;
}

describe('session', () => {
  it('joue une run entière du bot jusqu’à son terme, sans action refusée', async () => {
    const { session, view, store } = newSession();
    session.newRun(3);
    for (let i = 0; i < 400; i++) {
      const state = view().state;
      if (!state || state.phase === 'won' || state.phase === 'lost') break;
      const reason = await act(session, view, chooseAction(state, cardIndex));
      expect(reason).toBeNull();
      expect(view().busy).toBe(false);
    }
    expect(['won', 'lost']).toContain(view().state?.phase);
    await session.flush();
    expect(await store.read()).toBeNull();
  }, 30000);

  it('sauvegarde après chaque action et reprend au même point', async () => {
    const { session, view, store } = newSession();
    session.newRun(5);
    await act(session, view, { type: 'startFight' });
    await session.flush();
    const saved = await store.read();
    expect((saved as SaveFile).state).toEqual(view().state);

    const other = newSession(store);
    const restored = await other.session.savedRun();
    expect(restored).toEqual(view().state);
  });

  it('rend la raison d’un refus sans changer l’état', async () => {
    const { session, view } = newSession();
    session.newRun(5);
    await act(session, view, { type: 'startFight' });
    const before = view().state;
    expect(session.refusal({ type: 'play', uids: [] })).toBe('invalidCount');
    expect(await session.dispatch({ type: 'play', uids: [] })).toBe('invalidCount');
    expect(view().state).toBe(before);
  });

  it('ne garde pas l’état de l’animation une fois celle-ci passée', async () => {
    const { session, view } = newSession();
    session.newRun(5);
    await act(session, view, { type: 'startFight' });
    await act(session, view, { type: 'play', uids: view().state?.fight?.hand.slice(0, 1) ?? [] });
    expect(view().stage.beat).toBeNull();
    expect(view().stage.counter).toBeNull();
  });

  it('signale une sauvegarde qui échoue', async () => {
    const store = memoryStore();
    store.write = vi.fn().mockRejectedValue(new Error('quota'));
    const { session, view } = newSession(store);
    session.newRun(5);
    await session.flush();
    expect(view().saveFailed).toBe(true);
  });

  it('abandonner efface la sauvegarde', async () => {
    const { session, store } = newSession();
    session.newRun(5);
    await session.abandon();
    expect(await store.read()).toBeNull();
    expect(session.state).toBeNull();
  });

  it('passer une animation la termine aussitôt', async () => {
    const { session, view } = newSession();
    session.newRun(5);
    await act(session, view, { type: 'startFight' });
    const done = session.dispatch({
      type: 'play',
      uids: view().state?.fight?.hand.slice(0, 2) ?? [],
    });
    session.skip();
    const closing = setInterval(() => {
      if (view().stage.beat?.kind === 'gains') session.skip();
    }, 1);
    await done;
    clearInterval(closing);
    expect(view().busy).toBe(false);
  });
});
