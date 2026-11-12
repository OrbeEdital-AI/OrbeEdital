import { useLocation } from "wouter";
import AuthPage, { type AuthFormData } from "@/components/AuthPage";
import { trpc } from "@/lib/trpc";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation();
  const logout = trpc.auth.logout.useMutation();

  const submit = async (data: AuthFormData) => {
    if (data.mode !== "login") throw new Error("O acesso administrativo aceita somente contas já cadastradas.");
    const result = await login.mutateAsync({ email: data.email, password: data.password });
    await utils.auth.me.invalidate();

    if (result.user.role !== "superadmin" || !result.user.emailVerifiedAt) {
      await logout.mutateAsync();
      await utils.auth.me.setData(undefined, null);
      throw new Error("Esta conta não possui permissão de Administrador Geral ou ainda não confirmou o e-mail.");
    }

    navigate("/admin");
  };

  return (
    <AuthPage
      audience="admin"
      initialMode="login"
      onBack={() => navigate("/")}
      onForgotPassword={() => navigate("/forgot-password")}
      onSubmit={submit}
    />
  );
}
