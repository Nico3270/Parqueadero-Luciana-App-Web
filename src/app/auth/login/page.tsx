// src/app/auth/login/page.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { signIn } from "next-auth/react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeError(message?: string) {
  if (!message) return "No se pudo iniciar sesión. Intenta de nuevo.";
  if (message.toLowerCase().includes("credentials")) return "Email o contraseña incorrectos.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDisabled = useMemo(() => {
    return isPending || !email.trim() || password.length < 6;
  }, [email, password, isPending]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!res?.ok) {
        setError(normalizeError(res?.error ?? undefined));
        return;
      }

      // Redirige al home (o dashboard) al autenticarse
      window.location.href = "/";
    });
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Sistema de parqueadero
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Accede con tu email y contraseña para registrar entradas, salidas y pagos.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <form onSubmit={onSubmit} className="p-6 sm:p-7">
          {/* Error */}
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {/* Email */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <div className="mt-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="admin@parqueadero.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cx(
                  "w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-slate-900 shadow-sm outline-none transition",
                  "border-slate-200 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                )}
              />
            </div>
          </label>

          {/* Password */}
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Contraseña</span>
            <div className="mt-2 relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cx(
                  "w-full rounded-xl border bg-white px-4 py-3 pr-12 text-[15px] text-slate-900 shadow-sm outline-none transition",
                  "border-slate-200 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                )}
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {/* simple icon */}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="opacity-80"
                >
                  <path
                    d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  {showPassword ? null : (
                    <path
                      d="M4 20L20 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Mínimo 6 caracteres.
            </p>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={isDisabled}
            className={cx(
              "mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-[15px] font-medium",
              "transition shadow-sm",
              isDisabled
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
            )}
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Iniciando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>

          {/* Footer mini */}
          <div className="mt-6 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span className="truncate">
              © {new Date().getFullYear()} Parqueadero
            </span>
            <span className="truncate">Soporte: Admin</span>
          </div>
        </form>

        {/* Subtle bottom */}
        <div className="rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-600 sm:px-7">
          Tip: Si no puedes entrar, verifica tu email y que el usuario esté activo.
        </div>
      </div>

      {/* Background accent (responsive) */}
      <div aria-hidden className="pointer-events-none">
        <div className="fixed inset-0 -z-10 bg-white" />
        <div className="fixed -left-40 -top-40 -z-10 h-80 w-80 rounded-full bg-slate-100 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="fixed -bottom-48 -right-48 -z-10 h-96 w-96 rounded-full bg-slate-100 blur-3xl sm:h-[34rem] sm:w-[34rem]" />
      </div>
    </div>
  );
}