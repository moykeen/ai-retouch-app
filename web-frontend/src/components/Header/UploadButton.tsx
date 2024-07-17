import React, { useRef, ChangeEvent } from "react";

import { ReactComponent as Upload } from "../../assets/upload.svg";
import Tooltip from "../Tooltip";

// ディレクトリを受け付けるようにするhack https://github.com/facebook/react/issues/3468#issuecomment-1031366038
declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    webkitdirectory?: string;
    directory?: string;
  }
}

const UploadButton = ({
  onFileSelected,
  allowDirectory = false,
}: {
  onFileSelected: (files: File[]) => void;
  allowDirectory?: boolean;
}) => {
  const inputFileRef = useRef<HTMLInputElement>(null);

  const onChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    const files = target.files as FileList;

    if (files.length === 0) {
      return;
    }

    onFileSelected(Array.from(files));

    // reset selection in case the same file(s) will be selected next time
    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  const clickHandler = () => {
    if (inputFileRef && inputFileRef.current) {
      inputFileRef.current.click();
    }
  };

  return (
    <>
      <Tooltip
        content={allowDirectory ? "Select images" : "Select an image"}
        placement="bottom"
      >
        <Upload onClick={clickHandler} />
      </Tooltip>
      {allowDirectory ? (
        <input
          ref={inputFileRef}
          type="file"
          webkitdirectory=""
          // linterのエラー(?)でdirectoryが認識されない
          // eslint-disable-next-line react/no-unknown-property
          directory=""
          className="header__upload-image-input"
          onChange={onChangeHandler}
          accept="image/jpeg, image/png"
        />
      ) : (
        <input
          ref={inputFileRef}
          type="file"
          className="header__upload-image-input"
          onChange={onChangeHandler}
          accept="image/jpeg, image/png"
        />
      )}
    </>
  );
};

export default UploadButton;
