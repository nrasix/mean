import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function App() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void getCurrentWindow().hide();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Mean Translator</h1>
        <p className="text-sm text-neutral-400">
          Alt+Space — открыть, Esc — скрыть. Этап 3.
        </p>
      </div>
    </main>
  );
}
