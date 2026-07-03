import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — LÍDER C.O.R.E." },
      { name: "description", content: "Acesse a plataforma LÍDER C.O.R.E." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const dest = user.roles?.includes("super_admin") ? "/admin" : "/app";
      navigate({ to: dest, replace: true });
    }
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success("Bem-vindo de volta.");
      } else {
        await signUp(email, password, fullName);
        toast.success("Conta criada.");
      }
      // Redirect handled by the useEffect above once `user` populates.
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      {/* Painel esquerdo — marca */}
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground md:flex md:flex-col md:justify-between">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <Link to="/" className="relative flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground font-display text-lg font-semibold">
            L
          </span>
          <span className="font-display text-lg">líder core</span>
        </Link>
        <div className="relative">
          <p className="font-display text-3xl leading-tight md:text-4xl">
            "O líder não entra no sistema para preencher formulários.
            <br />
            Ele entra para <em className="text-accent">liderar</em>."
          </p>
          <p className="mt-6 text-sm text-primary-foreground/70">
            Neo Pessoas · Metodologia C.O.R.E.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-display font-semibold">
              L
            </span>
            <span className="font-display text-lg">líder core</span>
          </div>
          <h1 className="font-display text-3xl">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Acesse sua rotina de liderança."
              : "Comece a usar o LÍDER C.O.R.E."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Carregando..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}