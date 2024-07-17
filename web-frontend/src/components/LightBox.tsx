// Base implementation from https://github.com/theanam/react-awesome-lightbox/blob/master/src/index.js

import React from "react";
import { Image as ImageGridGallery } from "react-grid-gallery";

import { saveAs } from "file-saver";

import { AiStore } from "../stores/aiStore";

const DEFAULT_ZOOM_STEP = 0.4;
const DEFAULT_LARGE_ZOOM = 4;

function getXY(e: any) {
  let x = 0;
  let y = 0;
  if (e.touches && e.touches.length) {
    x = e.touches[0].pageX;
    y = e.touches[0].pageY;
  } else {
    x = e.pageX;
    y = e.pageY;
  }
  return { x, y };
}

function getImageFormat(dataUrl: string) {
  const mimeType = dataUrl.match(/^data:(image\/\w+)/);
  return mimeType?.[1];
}

function Cond(props: any) {
  if (!props.condition) return null;
  return <React.Fragment>{props.children}</React.Fragment>;
}

type LightBoxProps = {
  title?: string;
  images: ImageGridGallery[];
  currentIndex: number;
  setCurrentIndex: (currentIndex: number) => void;
  zoomStep?: number;
  onClose?: (e: any) => void;
  allowZoom?: boolean;
  allowReset?: boolean;
  buttonAlign?: "flex-end" | "flex-start" | "center";
  showTitle?: boolean;
  keyboardInteraction?: boolean;
  doubleClickZoom?: number;
  onNavigateImage?: (current: any) => void;
  aiStore: AiStore;
};

export default class Lightbox extends React.Component<LightBoxProps> {
  initX = 0;
  initY = 0;
  lastX = 0;
  lastY = 0;
  _cont = React.createRef<HTMLDivElement>();
  state = {
    x: 0,
    y: 0,
    zoom: 1,
    loading: true,
    moving: false,
    comparing: false,
  };

  createTransform = (x: number, y: number, zoom: number) => {
    return `scale(${zoom}) translate3d(${x}px,${y}px,0px)`;
  };

  createZoomTransform = (zoom: number) => `scale(${zoom}`;

  stopSideEffect = (e: any) => e.stopPropagation();

  getCurrentImage = () => {
    if (this.state.comparing) {
      return this.props.images[this.props.currentIndex]?.alt;
    }
    return this.props.images[this.props.currentIndex]?.src;
  };
  getCurrentImageCaption = () => {
    return this.props.images[this.props.currentIndex]?.caption as string;
  };

  comparable = () => {
    return this.props.images[this.props.currentIndex]?.alt ? true : false;
  };

  isFavorite = () => {
    return this.props.aiStore.isFavorite(this.props.currentIndex);
  };
  private toggleFavorite = () => {
    this.props.aiStore.toggleFavorite(this.props.currentIndex);
  };
  private deleteFromHistory = () => {
    this.props.aiStore.deleteFromHistory(this.props.currentIndex);
  };
  private setTargetImageAndClose = (e: any) => {
    this.props.aiStore.setTargetImageDataFromHistory(this.props.currentIndex);
    this.exit(e);
  };

  resetZoom = () => this.setState({ x: 0, y: 0, zoom: 1 });

  shockZoom = (e: any) => {
    const {
      zoomStep = DEFAULT_ZOOM_STEP,
      allowZoom = true,
      doubleClickZoom = DEFAULT_LARGE_ZOOM,
    } = this.props;
    if (!allowZoom || !doubleClickZoom) return false;
    this.stopSideEffect(e);
    if (this.state.zoom > 1) return this.resetZoom();
    const _z =
      (zoomStep < 1 ? Math.ceil(doubleClickZoom / zoomStep) : zoomStep) *
      zoomStep;
    const _xy = getXY(e);
    const _cbr = this._cont.current?.getBoundingClientRect?.();
    const _ccx = _cbr!.x + _cbr!.width / 2;
    const _ccy = _cbr!.y + _cbr!.height / 2;
    const x = (_xy.x - _ccx) * -1; //* _z;
    const y = (_xy.y - _ccy) * -1; //* _z;
    this.setState({ x, y, zoom: _z });
    // this.setState({ zoom: _z });
  };

  navigateImage = (direction: "next" | "prev", e: any) => {
    this.stopSideEffect(e);
    let current = 0;
    switch (direction) {
      case "next":
        current = this.props.currentIndex + 1;
        break;
      case "prev":
        current = this.props.currentIndex - 1;
        break;
    }
    if (current >= this.props.images.length) current = 0;
    else if (current < 0) current = this.props.images.length - 1;
    this.props.setCurrentIndex(current);

    this.setState({
      //   x: 0,
      //   y: 0,
      //   zoom: 1,
      loading: true,
      comparing: false,
    });
    this.props.onNavigateImage?.(current);
  };

  startMove = (e: any) => {
    if (this.state.zoom <= 1) return false;
    this.setState({ moving: true });
    const xy = getXY(e);
    this.initX = xy.x;
    this.initY = xy.y;
  };

  duringMove = (e: any) => {
    if (!this.state.moving) return false;
    const xy = getXY(e);
    this.lastX = xy.x - this.initX;
    this.lastY = xy.y - this.initY;
    this.setState({
      x: this.state.x + (xy.x - this.initX) / this.state.zoom,
      y: this.state.y + (xy.y - this.initY) / this.state.zoom,
    });
    this.initX = xy.x;
    this.initY = xy.y;
  };

  endMove = (e: any) => this.setState({ moving: false });

  applyZoom = (type: any) => {
    const { zoomStep = DEFAULT_ZOOM_STEP } = this.props;
    let newZoom: number;
    switch (type) {
      case "in":
        this.setState({ zoom: this.state.zoom + zoomStep });
        break;
      case "out":
        newZoom = this.state.zoom - zoomStep;
        if (newZoom < 1) break;
        else if (newZoom === 1) this.setState({ x: 0, y: 0, zoom: 1 });
        else this.setState({ zoom: newZoom });
        break;
      case "reset":
        this.resetZoom();
        break;
    }
  };

  download = () => {
    const imageUrl = this.getCurrentImage();
    if (!imageUrl) return;
    const imageFormat = getImageFormat(imageUrl);
    if (!imageFormat) return;

    const timestamp = Math.floor(Date.now() / 100);

    let caption = this.getCurrentImageCaption();
    caption = caption.slice(0, caption.lastIndexOf("."));

    let extension: string;
    if (imageFormat === "image/png") extension = "png";
    else if (imageFormat === "image/jpeg") extension = "jpg";
    else extension = imageFormat.split("/")[1];

    saveAs(imageUrl, `${caption}-${timestamp}.${extension}`);
  };

  toggleComparing = () => {
    this.setState({ comparing: !this.state.comparing });
  };

  reset = (e: any) => {
    this.stopSideEffect(e);
    this.setState({ x: 0, y: 0, zoom: 1 });
  };

  exit = (e: any) => {
    this.props.onClose?.(e);
    this.props.setCurrentIndex(-1);
  };

  shouldShowReset = () => this.state.x || this.state.y || this.state.zoom !== 1;

  canvasClick = (e: any) => {
    if (this.state.zoom <= 1) return this.exit(e);
  };

  keyboardNavigation = (e: any) => {
    const { allowZoom = true, allowReset = true } = this.props;
    const { x, y, zoom } = this.state;
    switch (e.key) {
      case "ArrowLeft":
        if (this.props.images.length > 1) this.navigateImage("prev", e);
        break;
      case "ArrowRight":
        if (this.props.images.length > 1) this.navigateImage("next", e);
        break;
      case "+":
        if (allowZoom) this.applyZoom("in");
        break;
      case "-":
        if (allowZoom) this.applyZoom("out");
        break;
      case "Escape":
        if (allowReset && this.shouldShowReset()) this.reset(e);
        else this.exit(e);
        break;
    }
  };

  componentDidMount() {
    document.body.classList.add("lb-open-lightbox");
    const { keyboardInteraction = true } = this.props;
    if (keyboardInteraction)
      document.addEventListener("keyup", this.keyboardNavigation);
  }

  componentWillUnmount() {
    document.body.classList.remove("lb-open-lightbox");
    const { keyboardInteraction = true } = this.props;
    if (keyboardInteraction)
      document.removeEventListener("keyup", this.keyboardNavigation);
  }

  render() {
    const image = this.getCurrentImage(); //this.state, this.props);
    const caption = this.getCurrentImageCaption();

    if (!image) {
      return;
    }

    const {
      allowZoom = true,
      buttonAlign = "center",
      showTitle = true,
      allowReset = true,
    } = this.props;
    const { x, y, zoom, loading, moving, comparing } = this.state;
    const _reset = allowReset && this.shouldShowReset();

    return (
      <div className="lb-container">
        <div className="lb-header" style={{ justifyContent: buttonAlign }}>
          <div className="lb-title-mini">
            {caption ? (caption as string) : ""}
          </div>
          <Cond condition={this.comparable()}>
            <div
              title="Compare to original"
              className={`lb-button lb-icon-compare ${
                comparing ? "lb-comparing" : ""
              }`}
              onClick={() => this.toggleComparing()}
            ></div>
          </Cond>
          <Cond condition={true}>
            <div
              title="Download"
              className="lb-button lb-icon-download"
              onClick={() => this.download()}
            ></div>
          </Cond>
          <Cond condition={true}>
            <div
              title="Edit"
              className="lb-button lb-icon-edit"
              onClick={(e) => this.setTargetImageAndClose(e)}
            ></div>
          </Cond>
          <Cond condition={true}>
            <div
              title="Mark as favorite"
              className={`lb-button ${
                this.isFavorite()
                  ? "lb-icon-favorite-filled"
                  : "lb-icon-favorite-empty"
              }`}
              onClick={() => this.toggleFavorite()}
            ></div>
          </Cond>
          <Cond condition={true}>
            <div
              title="Delete from history"
              className="lb-button lb-icon-delete"
              onClick={() => this.deleteFromHistory()}
            ></div>
          </Cond>
          <Cond condition={buttonAlign === "center" || _reset}>
            <div
              title="Reset"
              style={{ order: buttonAlign === "flex-start" ? "1" : "unset" }}
              className={`lb-button lb-icon-reset lb-hide-mobile reload ${
                _reset ? "" : "lb-disabled"
              }`}
              onClick={this.reset}
            ></div>
          </Cond>
          <Cond condition={this.props.images.length > 1}>
            <div
              title="Previous"
              className="lb-button lb-icon-arrow prev lb-hide-mobile"
              onClick={(e) => this.navigateImage("prev", e)}
            ></div>
            <div
              title="Next"
              className="lb-button lb-icon-arrow next lb-hide-mobile"
              onClick={(e) => this.navigateImage("next", e)}
            ></div>
          </Cond>
          <Cond condition={allowZoom}>
            <div
              title="Zoom In"
              className="lb-button lb-icon-zoomin zoomin"
              onClick={() => this.applyZoom("in")}
            ></div>
            <div
              title="Zoom Out"
              className={`lb-button lb-icon-zoomout zoomout ${
                zoom <= 1 ? "lb-disabled" : ""
              }`}
              onClick={() => this.applyZoom("out")}
            ></div>
          </Cond>
          <div
            title="Close"
            className="lb-button lb-icon-close close"
            style={{ order: buttonAlign === "flex-start" ? "-1" : "unset" }}
            onClick={(e) => this.exit(e)}
          ></div>
        </div>
        <div
          className={`lb-canvas${loading ? " lb-loading" : ""}`}
          ref={this._cont}
          onClick={(e) => this.canvasClick(e)}
        >
          <img
            draggable="false"
            style={{
              transform: this.createTransform(x, y, zoom),
              cursor: zoom > 1 ? "grab" : "unset",
              objectFit: "contain",
            }}
            onMouseDown={(e) => this.startMove(e)}
            onTouchStart={(e) => this.startMove(e)}
            onMouseMove={(e) => this.duringMove(e)}
            onTouchMove={(e) => this.duringMove(e)}
            onMouseUp={(e) => this.endMove(e)}
            onMouseLeave={(e) => this.endMove(e)}
            onTouchEnd={(e) => this.endMove(e)}
            onClick={(e) => this.stopSideEffect(e)}
            onDoubleClick={(e) => this.shockZoom(e)}
            onLoad={(e) => this.setState({ loading: false })}
            className={`lb-img${loading ? " lb-loading" : ""}`}
            // title={title}
            src={image}
            alt={caption ? (caption as string) : ""}
            width="100%"
            height="100%"
          />
          <div className="mobile-controls lb-show-mobile">
            <div
              title="Previous"
              className="lb-button lb-icon-arrow prev"
              onClick={(e) => this.navigateImage("prev", e)}
            ></div>
            {_reset ? (
              <div
                title="Reset"
                className="lb-button lb-icon-reset reload"
                onClick={this.reset}
              ></div>
            ) : null}
            <div
              title="Next"
              className="lb-button lb-icon-arrow next"
              onClick={(e) => this.navigateImage("next", e)}
            ></div>
          </div>
        </div>
      </div>
    );
  }
}
