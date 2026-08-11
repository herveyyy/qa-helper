export const ICON_BTN_CLASS =
  "grid h-8 w-8 place-items-center rounded-full text-neutral-700 transition hover:bg-black/8 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 data-[active=true]:bg-black data-[active=true]:text-white";

export interface WidgetElements {
  root: HTMLDivElement;
  backdrop: HTMLDivElement;
  dock: HTMLElement;
  panel: HTMLElement;
  panelHeader: HTMLElement;
  panelTitle: HTMLElement;
  panelBody: HTMLElement;
  highlight: HTMLDivElement;
  pickHint: HTMLDivElement;
  pinLayer: HTMLDivElement;
  fab: HTMLButtonElement;
  fabIcon: HTMLImageElement;
  btnBack: HTMLButtonElement;
  btnEnv: HTMLButtonElement;
  btnUser: HTMLButtonElement;
  btnTheme: HTMLButtonElement;
  btnPin: HTMLButtonElement;
  btnClosePanel: HTMLButtonElement;
}
