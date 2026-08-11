"use client";

import Link from "next/link";
import { MessageCircle, Calendar, Target, User } from "lucide-react";

const NAV_ITEMS = [
  { key: "chat", href: "/", label: "Chat", icon: MessageCircle },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: Calendar },
  { key: "goals", href: "/goals", label: "Goals", icon: Target },
  { key: "profile", href: "/profile", label: "Profile", icon: User },
] as const;

export default function BottomNav({ active }: { active: "chat" | "calendar" | "goals" | "profile" }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#2E3236] bg-[#1B1D1F] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto flex gap-2 px-4 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2.5 rounded-md border transition-colors ${
                isActive
                  ? "bg-[#7DD3C0]/10 border-[#7DD3C0] text-[#7DD3C0]"
                  : "bg-[#232628] border-[#3A3F45] text-[#EDEAE3] hover:bg-[#2A2E32]"
              }`}
            >
              <Icon size={16} /> {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
