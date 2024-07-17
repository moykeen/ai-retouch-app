import { observable, action, makeObservable } from "mobx";

import { ModeName } from "./canvasStore";
import { RootStore } from "./rootStore";

export class UIStore {
  @observable isToolbarOpen = false;
  @observable canUndo = false;
  @observable canRedo = false;

  @observable inProgress = false;

  private currentAbortController?: AbortController;

  constructor(private readonly root: RootStore) {
    makeObservable(this);
  }

  @action toggleToolbar(mode: ModeName): void {
    // console.log(mode);
    if (this.root.canvasStore.mode === mode || !this.isToolbarOpen) {
      this.isToolbarOpen = !this.isToolbarOpen;
    }
    this.root.canvasStore.setMode(mode);
  }

  @action closeToolbar(): void {
    this.isToolbarOpen = false;
    this.root.canvasStore.setMode("");
  }

  @action updateHistoryButtons(canUndo: boolean, canRedo: boolean): void {
    this.canUndo = canUndo;
    this.canRedo = canRedo;
  }

  @action setInprogress(inProgress: boolean): void {
    this.inProgress = inProgress;
  }

  prepareForAbort(): AbortSignal {
    this.currentAbortController = new AbortController();
    return this.currentAbortController.signal;
  }

  abortCurrentProcess() {
    this.currentAbortController!.abort();
  }
}
