"use client";

import { signOut } from "next-auth/react";

type Props = {
  className?: string;
};

export default function LogoutButton({ className }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className || "btn btn-danger"}
    >
      Cikis Yap
    </button>
  );
}
