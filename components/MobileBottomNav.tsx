"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Swords, 
  Brain, 
  UploadCloud 
} from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/players", label: "Kỳ thủ", icon: Users },
    { href: "/analyze", label: "Bàn cờ", icon: Swords },
    { href: "/ai-coach", label: "Trợ lí AI", icon: Brain, badge: "AI" },
    { href: "/import", label: "Nạp ván", icon: UploadCloud },
  ];

  return (
    <nav 
      aria-label="Điều hướng di động"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-lg px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-all"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2.5 px-1 py-0.2 rounded-full text-[8px] font-black bg-emerald-500 text-white leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-full ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0.5 w-6 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-xs" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
