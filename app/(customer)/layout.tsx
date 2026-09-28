import type { ReactNode } from "react";

/**
 * Customer app shell.
 *
 * There is no navigation any more: the whole customer-facing site is this one
 * booking screen, so a tab bar would only be links to pages that do not exist.
 *
 * Wide editorial shell on desktop, compact and clipped on mobile.
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <main className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
