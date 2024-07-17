import React, { useRef } from "react";
import Alert from "react-s-alert";

import { observer } from "mobx-react-lite";

import useStore from "../../hooks/useStore";
import UploadButton from "../Header/UploadButton";

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const extractNumber = (filename: string) => {
  const match = filename.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
};

const ToolbarBatch: React.FC = observer(() => {
  const { aiStore, authStore, maskStore } = useStore();
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const setImage = async (files: File[]) => {
    const sortedFiles = [...files].sort(
      (a, b) => a.lastModified - b.lastModified
    );

    const parts = JSON.parse(aiStore.batchScript).range.split("...");
    const startIndex = Number(parts[0]);
    const endIndex = Number(parts[1]);

    try {
      for (const file of sortedFiles) {
        if (!file.type.startsWith("image/")) {
          console.log(`skip ${file.name}`);
          continue;
        }
        const fileNumber = extractNumber(file.name);
        if (
          fileNumber !== undefined &&
          (fileNumber < startIndex || fileNumber > endIndex)
        ) {
          console.log(`skip ${file.name}`);
          continue;
        }

        await processFile(file);
      }
      Alert.success("Batch process successfully done", {
        position: "bottom-left",
      });
    } catch {
      Alert.error("Batch process aborted", {
        position: "bottom-left",
      });
    }
  };

  const processFile = async (file: File) => {
    console.log("start processing", file.name);
    const imageUrl = await readFileAsDataURL(file);
    aiStore.setTargetImageData(imageUrl, file.name);

    // wait for image has been loaded to <img>
    await new Promise<void>((resolve) => {
      if (imgRef.current) {
        imgRef.current.onload = () => {
          resolve();
        };
      }
    });

    await aiStore.scriptingProcess(imgRef.current!, file.name);
  };

  return (
    <div className="toolbar__content">
      {authStore.canUseBatch() ? (
        <>
          <div className="preview__header">
            <UploadButton onFileSelected={setImage} allowDirectory={true} />
          </div>
          <div className="toolbar__block">
            <textarea
              style={{ width: "100%", height: "10vw" }}
              placeholder="Enter your script.."
              value={aiStore.batchScript}
              ref={scriptRef}
              onChange={({ target: { value } }) => {
                aiStore.setBatchScript(value);
              }}
            />
          </div>
          <div className="toolbar__composite_wrapper">
            <img
              ref={imgRef}
              src={aiStore.imageData}
              className="preview__mini"
              alt=""
            ></img>
          </div>
        </>
      ) : (
        <div>Not available to free users</div>
      )}
    </div>
  );
});

export default ToolbarBatch;
