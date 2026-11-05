interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-12 z-50 flex justify-center">
      <div className="rounded-lg border border-white/10 bg-neutral-800/95 px-3 py-1.5 text-xs text-neutral-100 shadow-xl">
        {message}
      </div>
    </div>
  );
}
