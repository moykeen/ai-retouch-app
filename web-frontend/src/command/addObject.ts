import { Command, CommandName } from "./commandHistory";
import { disableHistoryRecording } from "../helpers/decorators";

export class AddObjectCommand implements Command {
  name: CommandName = "add_object";

  constructor(
    private object: fabric.Object,
    private canvas: fabric.Canvas,
    private group: fabric.Group
  ) {}

  @disableHistoryRecording
  execute(): void {
    this.group.addWithUpdate(this.object);
    this.group.setCoords(); // TODO really this need?
    this.canvas.requestRenderAll();
  }

  undo(): void {
    this.group.removeWithUpdate(this.object);
    this.group.setCoords();
    this.canvas.requestRenderAll();
  }
}
