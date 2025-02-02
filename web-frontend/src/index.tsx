import React from "react";

import ReactDOM from "react-dom/client";

import "normalize.css";
import "./styles/main.scss";
import App from "./App";
import { StoreProvider } from "./helpers/storeProvider";
import reportWebVitals from "./reportWebVitals";
import rootStore from "./stores/rootStore";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  // <React.StrictMode>
  <StoreProvider value={rootStore}>
    <App />
  </StoreProvider>
  // </React.StrictMode>
);

// // If you want your app to work offline and load faster, you can change
// // unregister() to register() below. Note this comes with some pitfalls.
// // Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
