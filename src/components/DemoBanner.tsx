"use client";

import { useDemo } from "@/context/DemoContext";
import Link from "next/link";

export default function DemoBanner() {
  const { showDemoBanner } = useDemo();

  if (!showDemoBanner) return null;

  return (
    <div className="bg-yellow-500 text-black px-4 py-2 text-center text-sm font-medium">
      🎭 You're in <strong>Demo Mode</strong> - Browse only, no changes allowed.{" "}
      <Link href="/signup" className="underline hover:no-underline ml-2">
        Sign up for full access →
      </Link>
    </div>
  );
}