// 탭 창(가방·도감·캐릭터·기록·MY)이 마을·방 위에 열려 있는지. 열려 있으면 장면의 방향키·단축키가 움직이지 않는다
// (창 안의 글 칸에 W·A·S·D를 쳐도 캐릭터가 걷지 않게).

let open = false;

export function panelOpen(): boolean {
  return open;
}

export function setPanelOpen(v: boolean): void {
  open = v;
}

export type PanelTab = 'bag' | 'dex' | 'character' | 'archive' | 'my';

const OPEN_EVENT = 'scene:open-panel';

/** 마을·방 화면 어디서든 탭 창을 연다 (예: 책상을 누르면 기록 쓰기) */
export function openPanel(tab: PanelTab, opts: { startNew?: boolean } = {}): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { tab, ...opts } }));
}

export function onOpenPanel(fn: (tab: PanelTab, opts: { startNew?: boolean }) => void): () => void {
  const on = (e: Event) => {
    const d = (e as CustomEvent<{ tab: PanelTab; startNew?: boolean }>).detail;
    if (d?.tab) fn(d.tab, { startNew: d.startNew });
  };
  window.addEventListener(OPEN_EVENT, on);
  return () => window.removeEventListener(OPEN_EVENT, on);
}

/** 창을 닫았다 (방 화면이 바뀐 모습·기록을 다시 읽는다) */
export const PANEL_CLOSED_EVENT = 'scene:panel-closed';
