import { scan } from "react-scan"; // must be imported before React and React DOM
import React from "react";
import App from "./App";
import ReactDOM from "react-dom/client";
import "./index.css";

scan({
  enabled: true,
})

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(<App />);
