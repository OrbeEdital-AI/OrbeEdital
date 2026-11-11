import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import AuthRoute from "@/pages/AuthRoute";
import Portal from "@/pages/Portal";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "@/pages/EmailAuthPages";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const privacy = kind === "privacy";
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12">
      <a href="/" className="text-sm font-semibold text-cyan-800">← Voltar ao OrbeEdital</a>
      <h1 className="mt-6 text-3xl font-bold text-[#102B4E]">{privacy ? "Política de privacidade" : "Termos de uso"}</h1>
      <p className="mt-2 text-sm text-slate-500">Versão inicial — documento informativo, sujeito a revisão antes da operação comercial.</p>
      <div className="prose prose-slate mt-8">
        <h2>{privacy ? "Dados e finalidade" : "Uso da plataforma"}</h2>
        <p>{privacy ? "O OrbeEdital utiliza dados de conta e empresa fornecidos pelo usuário para autenticação e disponibilização dos recursos da plataforma. As oportunidades públicas são obtidas de fontes oficiais identificadas na interface. Recursos externos de e-mail, pagamentos e notificações ainda podem depender de configuração." : "O OrbeEdital organiza dados disponíveis em fontes públicas de compras governamentais para apoiar a pesquisa. O usuário deve conferir o edital, seus anexos, prazos e informações diretamente na fonte oficial antes de participar de qualquer procedimento."}</p>
        {privacy && <>
          <h2>Mensagens transacionais</h2>
          <p>Para confirmar o endereço de e-mail e enviar links de redefinição de senha, o OrbeEdital está sendo integrado ao provedor Resend. Quando o serviço estiver configurado, o endereço de e-mail e o nome da conta serão transmitidos ao provedor para entrega dessas mensagens. Os links contêm tokens temporários de uso único; a aplicação armazena somente o hash dos tokens.</p>
        </>}
        <h2>{privacy ? "Segurança e direitos" : "Fontes e disponibilidade"}</h2>
        <p>{privacy ? "Os dados particulares de cada conta devem ser usados somente para fornecer os serviços solicitados. Solicitações de acesso, correção ou exclusão podem ser encaminhadas pelos canais de contato do responsável pelo produto. Esta versão não substitui uma análise jurídica formal." : "A disponibilidade e a atualização dependem das fontes de origem e da sincronização efetivamente realizada. Não garantimos cobertura integral, atualização em tempo real, precisão de dados derivados ou resultado de participação."}</p>
        <h2>Contato</h2>
        <p>Os canais de contato comercial e de privacidade serão publicados quando configurados. Não envie documentos sigilosos ou credenciais por canais não aprovados.</p>
      </div>
    </main>
  );
}

function Router() {
  return <Switch>
    <Route path="/" component={Home}/>
    <Route path="/login"><AuthRoute initialMode="login"/></Route>
    <Route path="/register"><AuthRoute initialMode="register"/></Route>
    <Route path="/verify-email" component={VerifyEmailPage}/>
    <Route path="/forgot-password" component={ForgotPasswordPage}/>
    <Route path="/reset-password" component={ResetPasswordPage}/>
    <Route path="/app" component={Portal}/>
    <Route path="/app/*" component={Portal}/>
    <Route path="/terms"><LegalPage kind="terms"/></Route>
    <Route path="/privacy"><LegalPage kind="privacy"/></Route>
    <Route path="/404" component={NotFound}/>
    <Route component={NotFound}/>
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster/><Router/></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
