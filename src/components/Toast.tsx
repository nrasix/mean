interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 z-50 flex justify-center">
      <div className="rounded-md border border-line-strong bg-raised/95 px-3 py-1.5 text-[11px] text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md">
        {message}
      </div>
    </div>
  );
}
