import { Suspense } from "react";
import ResetPasswordPage from "@/components/m/reset-password-page";

export const metadata = { title: "Reset Password — Pit", robots: { index: false } };

export default function ResetPassword() {
  return <Suspense><ResetPasswordPage /></Suspense>;
}
