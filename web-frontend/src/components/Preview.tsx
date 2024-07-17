import React, { useState, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Gallery, ThumbnailImageProps } from "react-grid-gallery";
import ReactCrop, { Crop, PixelCrop, PercentCrop } from "react-image-crop";

import { observer } from "mobx-react-lite";
import { BsArrowsFullscreen as PreviewFullScreen } from "react-icons/bs";

import Lightbox from "./LightBox";
import { FavoriteButton, DeleteButton } from "./PreviewThumbnail";
import { CROP_ASPECT_RATIO_LIMIT } from "../helpers/imageManipulator";
import useStore from "../hooks/useStore";
import { AiStore } from "../stores/aiStore";
import "react-image-crop/dist/ReactCrop.css";

const ImageComponent = ({
  thumbnailImageProps,
  aiStore,
}: {
  thumbnailImageProps: ThumbnailImageProps;
  aiStore: AiStore;
}) => {
  const { key, src, style } = thumbnailImageProps.imageProps;

  const toggleFavoriteWrapper = (event: React.MouseEvent) => {
    event.stopPropagation();
    aiStore.toggleFavorite(key as number);
  };
  const deleteWrapper = (event: React.MouseEvent) => {
    event.stopPropagation();
    aiStore.deleteFromHistory(key as number);
  };

  return (
    <div style={{ ...style, textAlign: "center" }}>
      <img src={src} style={style} />
      <FavoriteButton
        isFavorite={aiStore.isFavorite(key as number)}
        onClick={toggleFavoriteWrapper}
      />
      <DeleteButton onClick={deleteWrapper} />
    </div>
  );
};

const Preview: React.FC = observer(() => {
  const { uiStore, aiStore } = useStore();

  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const placeholderImageUrl =
    "https://placehold.co/1000x1000?text=Drop+image+here";

  const setImage = (files: File[]) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageUrl = String(reader.result);
      aiStore.setTargetImageData(imageUrl, files[0].name);
    };
    reader.readAsDataURL(files[0]);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setImage(acceptedFiles);
  }, []);
  const { getRootProps } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const handleSelect = (index: number) => {
    aiStore.setTargetImageDataFromHistory(index);
  };
  const handleClick = (index: number) => {
    setLightboxIndex(index);
  };

  const setCropWithAspectRatioConstraint = (
    crop: PixelCrop,
    percentageCrop: PercentCrop
  ) => {
    if (
      (crop.width > crop.height &&
        crop.width / crop.height > CROP_ASPECT_RATIO_LIMIT) ||
      (crop.width < crop.height &&
        crop.height / crop.width > CROP_ASPECT_RATIO_LIMIT)
    )
      return;
    setCrop(crop);
  };

  const setCropForBodyPartAndStartEdit = async (bodyRegion: string) => {
    if (!imgRef.current) return;
    const c = await aiStore.setCropForBodyRegion(imgRef.current, bodyRegion);
    if (c) {
      setCrop(c);
    }
    await aiStore.setImageOnCanvas(imgRef.current, bodyRegion, true);
  };

  return (
    <section className="preview">
      <div className="preview__header">
        <h4 className="preview__title">RetouchApp</h4>
        {uiStore.inProgress && <div className="spinner"></div>}
      </div>

      <div {...getRootProps({ className: "dropzone" })}>
        <ReactCrop
          crop={crop}
          onChange={setCropWithAspectRatioConstraint}
          onComplete={(c) => {
            aiStore.setCroppedArea(c);
          }}
          minWidth={50}
          minHeight={50}
          style={{
            margin: "10px",
          }}
        >
          <img
            ref={imgRef}
            src={aiStore.imageData || placeholderImageUrl}
            className="preview"
            alt=""
          ></img>
        </ReactCrop>
      </div>
      <div className="preview__option_wrapper">
        <div
          className={`preview__option preview__option__option1 ${
            aiStore.imageData ? "preview__option_active" : ""
          }`}
          onClick={async () => {
            if (!imgRef.current) return;
            await aiStore.setImageOnCanvas(imgRef.current);
          }}
        >
          <p>Edit selection </p>
        </div>

        <div className="preview__option_stack_wrapper"></div>
        <div
          className={`preview__option preview__option__option2 ${
            aiStore.imageData ? "preview__option_active" : ""
          }`}
          onClick={() => {
            handleClick(aiStore.targetImageIndex);
          }}
        >
          <p>
            <PreviewFullScreen size={30} />
          </p>
        </div>
      </div>

      <Gallery
        images={aiStore.imageHistory.slice()}
        thumbnailImageComponent={(props: ThumbnailImageProps) => (
          <ImageComponent thumbnailImageProps={props} aiStore={aiStore} />
        )}
        onSelect={handleSelect}
        onClick={handleClick}
      />
      <Lightbox
        images={aiStore.imageHistory}
        currentIndex={lightboxIndex}
        setCurrentIndex={setLightboxIndex}
        aiStore={aiStore}
      />
    </section>
  );
});

export default Preview;
