import React from "react";

import { IoTrashOutline } from "react-icons/io5";
import { MdFavorite, MdFavoriteBorder } from "react-icons/md";

const thumbnailOverlayIconSize = 25;

export const FavoriteButton = ({
  isFavorite,
  onClick,
}: {
  isFavorite: boolean;
  onClick: (event: React.MouseEvent) => void;
}) => {
  const iconStyle: React.CSSProperties = {
    position: "absolute",
    top: 5,
    right: 5,
  };

  return isFavorite ? (
    <MdFavorite
      size={thumbnailOverlayIconSize}
      style={{ ...iconStyle, fill: "red" }}
      onClick={onClick}
    />
  ) : (
    <MdFavoriteBorder
      size={thumbnailOverlayIconSize}
      style={iconStyle}
      onClick={onClick}
    />
  );
};

export const DeleteButton = ({
  onClick,
}: {
  onClick: (event: React.MouseEvent) => void;
}) => {
  const iconStyle: React.CSSProperties = {
    position: "absolute",
    top: 5 + thumbnailOverlayIconSize,
    right: 5,
    color: "white",
  };

  return (
    <IoTrashOutline
      size={thumbnailOverlayIconSize}
      style={iconStyle}
      onClick={onClick}
    />
  );
};
