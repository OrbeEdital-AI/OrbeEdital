import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AuthPage, { type AuthFormData, type AuthMode } from "@/components/AuthPage";
import { trpc } from "@/lib/trpc";

export default function AuthRoute({ initialMode }: { initialMode: AuthMode }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState(initialMode);
  const selectedPlanCode = new URLSearchParams(window.location.search).get("plan");
  const plans = trpc.billing.plans.useQuery();
  const checkout = trpc.billing.checkout.useMutation();
  useEffect(() => { if (initialMode === "register" && !selectedPlanCode) navigate("/plans"); }, [initialMode, selectedPlanCode, navigate]);
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();

  const submit = async (data: AuthFormData) => {
    let verificationRequired = false;
    let deliveryNotice: "sent" | "unavailable" | undefined;
    if (data.mode === "login") {
      const result = await login.mutateAsync({ email: data.email, password: data.password });
      verificationRequired = result.emailVerificationRequired;
    } else {
      const catalog = plans.data ?? (await plans.refetch()).data;
      const selectedPlan = catalog?.find(plan => plan.code === selectedPlanCode);
      if (!selectedPlan) throw new Error("O plano escolhido não está disponível. Volte à página de planos e selecione novamente.");
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
      try {
        const payment = await checkout.mutateAsync({ planId: selectedPlan.id, interval: "monthly" });
        await utils.auth.me.invalidate();
        window.location.assign(payment.checkoutUrl);
      } catch (error) {
        await utils.auth.me.invalidate();
        const message = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
        navigate(`/plans?resume=${encodeURIComponent(selectedPlan.code)}&checkoutError=${encodeURIComponent(message)}`);
      }
      return;
    }
    await utils.auth.me.invalidate();
    navigate(verificationRequired ? `/verify-email${deliveryNotice ? `?delivery=${deliveryNotice}` : ""}` : "/app");
  };

  return (
    <AuthPage
      initialMode={mode}
      onModeChange={nextMode => { if (nextMode === "register" && !selectedPlanCode) navigate("/plans"); else setMode(nextMode); }}
      onBack={() => navigate("/")}
      onForgotPassword={() => navigate("/forgot-password")}
      onSubmit={submit}
    />
  );
}
