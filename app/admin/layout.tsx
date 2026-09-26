import type { ReactNode } from "react";

export const metadata = {
  title: {
    default: "ระบบจัดการร้าน — FLOOK BARBER",
    template: "%s — FLOOK BARBER Admin",
  },
};

/**
 * Deliberately thin.
 *
 * The admin shell and the passcode check live in `app/admin/(dash)/layout.tsx`,
 * not here, so that `/admin/login` can render without a shell or a redirect loop.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
