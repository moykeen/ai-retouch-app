export class BlobReader extends FileReader {
  readAsDataURL(blob: Blob | File): Promise<any> {
    // not sure the proper type for promise
    return new Promise((res, rej) => {
      super.addEventListener("load", ({ target }) => res(target?.result));
      super.addEventListener("error", ({ target }) => rej(target?.error));
      super.readAsDataURL(blob);
    });
  }
}

// convert Data URL to Blob by ChatGPT
export function dataURLToBlob(dataURL: string) {
  const byteString = atob(dataURL.split(",")[1]);
  const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
  // const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(byteString.length);
  // const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  // console.log(ab);
  // return new Blob([ab], { type: mimeString });
  return new Blob([ia], { type: mimeString });
}
