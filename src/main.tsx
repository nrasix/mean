import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// В релизе блокируем горячие клавиши DevTools: контекстное меню у нас своё.
if (import.meta.env.PROD) {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const devtoolsCombo =
      event.key === "F12" ||
      ((event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (key === "i" || key === "j" || key === "c" || key === "k"));

    if (devtoolsCombo) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
