import rootStore from "../stores/rootStore";

export type CommandName = "add_object" | "remove_object" | "remove_all_objects";

export interface Command {
  name: CommandName;
  execute: () => Promise<void> | void;
  undo: () => Promise<void> | void;
}

export class History {
  isCommandInProgress = false;
  private history: Command[] = [];
  private currentCommandIndex = -1;
  private canUndo = false;
  private canRedo = false;
  private canAddCommands = true;
  private readonly MAX_HISTORY_LENGTH: number = 50;

  push(command: Command): void {
    if (!this.canAddCommands) {
      return;
    }

    this.history.splice(
      this.currentCommandIndex + 1,
      this.history.length,
      command
    );

    if (this.history.length > this.MAX_HISTORY_LENGTH) {
      this.history.shift();
    }

    this.setCurrentCommandIndex(this.history.length - 1);
  }

  async undo(): Promise<void> {
    const currentCommand = this.history[this.currentCommandIndex];
    if (currentCommand) {
      this.isCommandInProgress = true;
      const nextCommandIndex = this.currentCommandIndex - 1;
      this.setCurrentCommandIndex(nextCommandIndex);
      await currentCommand.undo();

      this.isCommandInProgress = false;
    }
  }

  async redo(): Promise<void> {
    if (this.canRedo) {
      this.isCommandInProgress = true;
      const nextCommandIndex = this.currentCommandIndex + 1;
      const currentCommand = this.history[nextCommandIndex];
      this.setCurrentCommandIndex(nextCommandIndex);
      await currentCommand.execute();

      this.isCommandInProgress = false;
    }
  }

  clear(): void {
    this.history = [];
    this.setCurrentCommandIndex(-1);
  }

  disableRecording(): void {
    this.canAddCommands = false;
  }

  enableRecording(): void {
    this.canAddCommands = true;
  }

  get isRecordingEnabled(): boolean {
    return this.canUndo;
  }

  private setCurrentCommandIndex(index: number): void {
    this.currentCommandIndex = index;
    this.canUndo = index >= 0;
    this.canRedo = index + 1 <= this.history.length - 1;
    rootStore.uiStore.updateHistoryButtons(this.canUndo, this.canRedo);
  }
}
