"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  login: string;
  accent: string;
  shadow: string;
}

export default function CompareChallenge({ login, accent, shadow }: Props) {
  const [rival, setRival] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rival.trim().replace(/^@/, "");
    if (trimmed && trimmed.toLowerCase() !== login.toLowerCase()) {
      router.push(`/?compare=${encodeURIComponent(login)},${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-sm mx-auto">
      <input
        type="text"
        value={rival}
        onChange={(e) => setRival(e.target.value)}
        placeholder="compare with..."
        className="min-w-0 flex-1 border-2 border-black bg-white px-3 py-2 text-[10px] text-black font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black rounded-md"
      />
      <button
        type="submit"
        disabled={!rival.trim()}
        className="btn-press shrink-0 border-2 border-black px-5 py-2 text-[10px] font-bold text-black rounded-md transition-colors hover:bg-gray-50 disabled:opacity-40"
      >
        Compare
      </button>
    </form>
  );
}
