import { useState } from "react";
import { useLocation } from "wouter";
import AuthPage, { type AuthFormData, type AuthMode } from "@/components/AuthPage";
import { trpc } from "@/lib/trpc";

export default function AuthRoute({ initialMode }: { initialMode: AuthMode }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState(initialMode);
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();

  const submit = async (data: AuthFormData) => {
    let verificationRequired = false;
    let deliveryNotice: "sent" | "unavailable" | undefined;
    if (data.mode === "login") {
      const result = await login.mutateAsync({ email: data.email, password: data.password });
      verificationRequired = result.emailVerificationRequired;
    } else {
      const result = await register.mutateAsync({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        companyName: data.company,
        cnpj: data.cnpj,
        state: data.state,
        municipality: data.municipality,
        segment: data.segment,
      });
      verificationRequired = result.emailVerificationRequired;
      deliveryNotice = result.verificationEmailSent ? "sent" : "unavailable";
    }
    await utils.auth.me.invalidate();
    navigate(verificationRequired ? `/verify-email${deliveryNotice ? `?delivery=${deliveryNotice}` : ""}` : "/app");
  };

  return (
    <AuthPage
      initialMode={mode}
      onModeChange={setMode}
      onBack={() => navigate("/")}
      onForgotPassword={() => navigate("/forgot-password")}
      onSubmit={submit}
    />
  );
}
