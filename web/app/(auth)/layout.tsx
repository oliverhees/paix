import React from "react";

/**
 * Auth layout — minimal wrapper for login/register pages.
 * No sidebar, no header. Just the auth form centered.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
