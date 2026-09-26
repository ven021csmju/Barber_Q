import type { ReactNode } from "react";

/**
 * Customer app shell.
 *
 * There is no navigation any more: the whole customer-facing site is this one
 * booking screen, so a tab bar would only be links to pages that do not exist.
 *
 * Capped at 480px and centred so the mobile-first layout stays comfortable on a
 * desktop. `overflow-x-clip` guarantees no child can push the page sideways --
 * the previous layout let fixed-width rails and negative margins escape the
 * viewport at 360px.
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[480px] min-h-dvh overflow-x-clip">
      <main className="px-4 pt-4 pb-10 sm:px-5">{children}</main>
    </div>
  );
}
