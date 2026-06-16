"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LionShield } from "@/components/layout/LionShield";

export default function LoginPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const params = new URLSearchParams(window.location.search);
      router.replace(params.get("redirect") ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden bg-black">

      {/* Dot-grid overlay extra no login */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Glow central sutil */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)",
        }}
      />

      {/* Linhas de grade horizontal — atmosfera terminal */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(255,255,255,1) 28px)",
        }}
      />

      {/* Logo + marca */}
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center gap-3 mb-10"
      >
        <motion.div
          initial={{ scale: shouldReduceMotion ? 1 : 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          className="size-16 sm:size-20 text-white"
        >
          <LionShield className="w-full h-full" />
        </motion.div>

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.08em] text-white uppercase">
            Guardião
          </h1>
          <p
            className="mt-1 text-[10px] tracking-[0.28em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}
          >
            Sistema de Gestão de OS
          </p>
        </div>
      </motion.div>

      {/* Card de login */}
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 32, scale: shouldReduceMotion ? 1 : 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.55, delay: shouldReduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[360px] sm:max-w-sm"
      >
        {/* Borda exterior animada — glow de ativação */}
        <div
          className="absolute -inset-px rounded-[6px] opacity-40"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(255,255,255,0.08) 100%)",
          }}
        />

        <div
          className="relative rounded-[var(--radius-lg)] border px-6 py-7 sm:px-8 sm:py-8"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-line-strong)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Campo e-mail */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.30 }}
              className="flex flex-col gap-2"
            >
              <label
                htmlFor="email"
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-11 w-full rounded-[var(--radius-sm)] border bg-transparent px-3.5 text-sm text-white placeholder:text-[#3A3A3A] outline-none transition-all duration-200
                  focus:border-white/30 focus:bg-white/[0.03]"
                style={{ borderColor: "var(--color-line-strong)" }}
              />
            </motion.div>

            {/* Campo senha */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.38 }}
              className="flex flex-col gap-2"
            >
              <label
                htmlFor="password"
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-[var(--radius-sm)] border bg-transparent px-3.5 pr-12 text-sm text-white placeholder:text-[#3A3A3A] outline-none transition-all duration-200
                    focus:border-white/30 focus:bg-white/[0.03]"
                  style={{ borderColor: "var(--color-line-strong)" }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-white/8"
                  style={{ color: "var(--color-muted)" }}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </motion.div>

            {/* Erro */}
            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, height: 0, marginTop: -8 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: -8 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-[var(--radius-sm)] border px-3 py-2 text-xs text-white"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Botão de entrar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.46 }}
            >
              <button
                type="submit"
                disabled={loading}
                className="group relative h-11 w-full overflow-hidden rounded-[var(--radius-sm)] bg-white font-semibold text-sm text-black transition-all duration-200
                  hover:bg-[#E8E8E8] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>
            </motion.div>

          </form>
        </div>
      </motion.div>

      {/* Rodapé */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="relative mt-8 text-[10px] tracking-[0.16em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-disabled)" }}
      >
        v2.0 · Acesso restrito
      </motion.p>
    </div>
  );
}
