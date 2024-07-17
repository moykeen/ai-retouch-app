import rootStore from "../stores/rootStore";

export function preventScaleReset(
  target: any,
  methodName: string,
  descriptor: PropertyDescriptor
): void {
  const method = descriptor.value;
  descriptor.value = async function (...args: any) {
    let returnValue: any;
    if (rootStore.uiStore.isToolbarOpen) {
      returnValue = await method.apply(this, args);
      rootStore.canvasStore.setScale(1);
    } else {
      rootStore.canvasStore.setScale(1);
      returnValue = await method.apply(this, args);
      rootStore.canvasStore.resetToBaseScale();
    }
    return returnValue;
  };
}

export function disableHistoryRecording(
  target: any,
  methodName: string,
  descriptor: PropertyDescriptor
): void {
  const method = descriptor.value;
  descriptor.value = async function (...args: any) {
    rootStore.canvasStore.history.disableRecording();
    const returnValue = await method.apply(this, args);
    rootStore.canvasStore.history.enableRecording();
    return returnValue;
  };
}
