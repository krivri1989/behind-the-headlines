"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const isRoot = pathname === "/dashboard";
  return <><nav className="page-navigation" aria-label="Page navigation">{!isRoot && <button type="button" onClick={() => router.back()}><ArrowLeft size={16} /> Back</button>}</nav>{children}</>;
}
