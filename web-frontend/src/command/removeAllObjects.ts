// TODO うまく動かなかったので、undo非対応の処理として、drawingStoreに処理を直に実装してある
import { Command, CommandName } from "./commandHistory";
import { disableHistoryRecording } from "../helpers/decorators";

export class RemoveAllObjectsCommand implements Command {
  name: CommandName = "remove_all_objects";

  private objects: fabric.Object[];

  constructor(
    // private object: fabric.Object,
    private canvas: fabric.Canvas,
    private group: fabric.Group
  ) {
    this.objects = this.group.getObjects();
    // console.log("To be deleted:");
    // console.log(this.objects);
  }

  execute(): void {
    for (const obj of this.objects) {
      this.group.removeWithUpdate(obj);
      // console.log("deteted", obj);
    }
    this.group.setCoords();
    this.canvas.requestRenderAll();
  }

  @disableHistoryRecording
  undo(): void {
    for (const obj of this.objects) {
      this.group.addWithUpdate(obj);
      // console.log("added", obj);
    }
    this.group.setCoords(); // TODO really this need?
    this.canvas.requestRenderAll();
  }
}
