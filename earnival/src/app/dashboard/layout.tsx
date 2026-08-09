import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
