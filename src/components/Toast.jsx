"use client";

import { useEffect } from "react";

export default function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-300">
      <div
        className={`px-5 py-3 rounded-xl shadow-xl border text-sm font-medium flex items-center gap-3 ${
          type === "success"
            ? "bg-[#0a121c] border-[#7cc7e8]/40 text-[#f0f9ff]"
            : "bg-[#0a121c] border-red-500/40 text-[#f0f9ff]"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            type === "success" ? "bg-[#7cc7e8]" : "bg-red-400"
          }`}
        />
        {message}
      </div>
    </div>
  );
}
