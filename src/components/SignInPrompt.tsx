import { Link } from "@tanstack/react-router";

export function SignInPrompt({ text }: { text: string }) {
  return (
    <div className="glass-panel mt-6 rounded-3xl p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link to="/auth" className="mt-4 inline-block rounded-2xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
        تسجيل الدخول
      </Link>
    </div>
  );
}
