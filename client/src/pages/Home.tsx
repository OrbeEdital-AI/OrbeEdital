import { useLocation } from "wouter";
import LandingPage from "@/components/LandingPage";

export default function Home() {
  const [, navigate] = useLocation();
  return <LandingPage onGetStarted={() => navigate("/plans")} onLogin={() => navigate("/login")} />;
}
