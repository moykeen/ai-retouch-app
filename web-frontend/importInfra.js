/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");

const filePath = "../infra/deployed-resources.json";

function convertCamelCaseToUpperCase(camelCaseStr) {
  const words = camelCaseStr.split(/(?=[A-Z])/);
  const upperCaseStr = words.map((word) => word.toUpperCase()).join("_");
  return upperCaseStr;
}

fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const jsonData = JSON.parse(data);
  const serviceStack = jsonData["RetouchAppServiceStack"];
  for (let key in serviceStack) {
    const value = serviceStack[key];
    console.log(`REACT_APP_${convertCamelCaseToUpperCase(key)}=${value}`);
  }
});
