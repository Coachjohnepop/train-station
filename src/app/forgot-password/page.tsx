import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/images/logo.png" alt="The Train Station" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 text-2xl font-bold">Forgot password</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            We&apos;re still rolling out full password reset. Here&apos;s what works today.
          </p>
        </div>

        <div className="card space-y-4 text-sm text-[var(--muted)]">
          <p>
            <strong className="text-[var(--foreground)]">Beta accounts:</strong> leave the password field blank on
            sign in — invited members can sign in with email only for now.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Need a reset?</strong> message your coach in the app or
            email{" "}
            <a href="mailto:jeremy@thetrainstation.co" className="text-accent hover:underline">
              jeremy@thetrainstation.co
            </a>{" "}
            and we&apos;ll help you get back in.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Not invited yet?</strong>{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Join the waitlist
            </Link>{" "}
            — we&apos;ll email you when your spot opens.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
          <Link href="/" className="text-[var(--muted)] hover:text-accent transition">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}