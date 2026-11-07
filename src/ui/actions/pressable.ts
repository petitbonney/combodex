/**
 * Gestes sur une rangée d'éléments marqués `data-press-id` : appui long et glisser pour réordonner.
 * Le toucher simple reste un `click` natif, donc accessible au clavier.
 */
export interface PressableOptions {
  onLongPress?: (id: string) => void;
  /** Réordonne de `from` vers `to` ; sans ce rappel, le glisser est inactif. */
  onReorder?: (from: number, to: number) => void;
  disabled?: boolean;
}

const LONG_PRESS_MS = 420;
const DRAG_THRESHOLD = 9;

export function pressable(node: HTMLElement, initial: PressableOptions) {
  let options = initial;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number; id: number } | null = null;
  let target: HTMLElement | null = null;
  let suppressClick = false;
  let drag: { items: HTMLElement[]; from: number; to: number; centers: number[] } | null = null;

  const items = () => [...node.querySelectorAll<HTMLElement>('[data-press-id]')];

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const reset = () => {
    clearTimer();
    start = null;
    target = null;
    drag = null;
  };

  const clearStyles = (entries: HTMLElement[]) => {
    for (const item of entries) {
      item.style.removeProperty('translate');
      item.style.removeProperty('z-index');
      item.style.removeProperty('transition');
      item.classList.remove('dragging');
    }
  };

  function beginDrag(event: PointerEvent): void {
    if (!target) return;
    const entries = items();
    const from = entries.indexOf(target);
    if (from < 0 || entries.length < 2) return;
    const centers = entries.map((item) => {
      const box = item.getBoundingClientRect();
      return box.left + box.width / 2;
    });
    drag = { items: entries, from, to: from, centers };
    suppressClick = true;
    clearTimer();
    target.classList.add('dragging');
    target.style.zIndex = '40';
    target.style.transition = 'none';
    node.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent): void {
    if (!drag || !start) return;
    const { items: entries, from, centers } = drag;
    const dx = event.clientX - start.x;
    const moved = entries[from] as HTMLElement;
    moved.style.translate = `${dx}px 0`;
    const position = (centers[from] as number) + dx;
    let to = 0;
    centers.forEach((center, index) => {
      if (index !== from && position > center) to += 1;
    });
    drag.to = to;
    entries.forEach((item, index) => {
      if (index === from) return;
      const left = (centers[index - 1] ?? centers[index] ?? 0) - (centers[index] ?? 0);
      const right = (centers[index + 1] ?? centers[index] ?? 0) - (centers[index] ?? 0);
      let shift = 0;
      if (from < index && index <= to) shift = left;
      if (to <= index && index < from) shift = right;
      item.style.translate = shift === 0 ? '' : `${shift}px 0`;
    });
  }

  const onPointerDown = (event: PointerEvent) => {
    if (options.disabled || event.button !== 0) return;
    const hit = (event.target as HTMLElement).closest<HTMLElement>('[data-press-id]');
    if (!hit || !node.contains(hit)) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    target = hit;
    suppressClick = false;
    if (options.onLongPress) {
      timer = setTimeout(() => {
        timer = null;
        suppressClick = true;
        const id = target?.dataset.pressId;
        if (id !== undefined) options.onLongPress?.(id);
        reset();
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    if (drag) {
      moveDrag(event);
      return;
    }
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance < DRAG_THRESHOLD) return;
    clearTimer();
    if (options.onReorder) beginDrag(event);
  };

  const onPointerUp = () => {
    if (drag) {
      const { items: entries, from, to } = drag;
      clearStyles(entries);
      if (from !== to) options.onReorder?.(from, to);
    }
    reset();
  };

  const onPointerCancel = () => {
    if (drag) clearStyles(drag.items);
    reset();
  };

  /** Une souris qui sort de la rangée annule l'appui ; un doigt reste capturé. */
  const onPointerLeave = () => {
    if (!drag) reset();
  };

  const onClick = (event: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const onContextMenu = (event: MouseEvent) => {
    const hit = (event.target as HTMLElement).closest<HTMLElement>('[data-press-id]');
    if (!hit || !options.onLongPress) return;
    event.preventDefault();
    // Sur mobile, l'appui long a déjà ouvert la fiche.
    if (suppressClick) return;
    const id = hit.dataset.pressId;
    if (id !== undefined) options.onLongPress(id);
  };

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerUp);
  node.addEventListener('pointercancel', onPointerCancel);
  node.addEventListener('pointerleave', onPointerLeave);
  node.addEventListener('click', onClick, true);
  node.addEventListener('contextmenu', onContextMenu);

  return {
    update(next: PressableOptions) {
      options = next;
    },
    destroy() {
      clearTimer();
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerCancel);
      node.removeEventListener('pointerleave', onPointerLeave);
      node.removeEventListener('click', onClick, true);
      node.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
