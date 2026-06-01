"use client";

export interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`cursor-pointer border px-4 py-2 text-left text-xs transition-opacity ${
            t.type === "success"
              ? "border-lime/60 bg-lime/10 text-lime"
              : "border-red-800 bg-red-900/30 text-red-400"
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
