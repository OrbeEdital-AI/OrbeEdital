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
      await logout.mutateAsync().catch(() => undefined);
      await utils.auth.me.setData(undefined, null);
      if (!result.user.emailVerifiedAt) {
        throw new Error("E-mail e senha reconhecidos, mas o endereço ainda não foi confirmado. Confirme o e-mail da conta e tente novamente.");
      }
      throw new Error("E-mail e senha reconhecidos, mas esta conta não tem o perfil Administrador Geral. O acesso ao painel exige autorização superadmin; solicite a liberação ao responsável pela plataforma.");
    }

    navigate("/app/admin");
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
