import { redirect } from "next/navigation";

/** Old URL — Reset password is the public name. */
export default function ForgotPasswordRedirectPage() {
  redirect("/reset-password");
}
