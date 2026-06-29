"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
    >
      <LogOut size={16} />
      ログアウト
    </button>
  );
}
