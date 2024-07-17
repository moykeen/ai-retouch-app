import React, { useRef, useEffect } from "react";

import { observer } from "mobx-react-lite";

import useStore from "../hooks/useStore";

const Canvas = observer(() => {
  const canvasRef = useRef<HTMLElement>(null);
  const canvasEl = canvasRef.current;
  const rootStore = useStore();
  const { uiStore } = rootStore;

  useEffect(() => {
    if (!canvasEl) {
      return;
    }
    rootStore.addWorkingCanvasToDocument(canvasEl);
  }, [canvasEl]);

  return (
    <section
      className={`canvas custom-scrollbar ${
        uiStore.isToolbarOpen ? "canvas_toolbar-open" : ""
      }`}
      ref={canvasRef}
    ></section>
  );
});

export default Canvas;
