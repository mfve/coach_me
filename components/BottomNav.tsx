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
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2DCD0] bg-[#FFFFFF] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto flex gap-2 px-4 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2.5 rounded-xl border transition-colors ${
                isActive
                  ? "bg-[#5FC2AB]/10 border-[#2E9C86] text-[#2E9C86]"
                  : "bg-[#F3EFE7] border-[#D9D2C4] text-[#2B261F] hover:bg-[#EFE9DE]"
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
