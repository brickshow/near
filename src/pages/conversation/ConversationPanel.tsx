import { useState, type ReactNode } from "react";
import { HomeNavigation, type HomeSection } from "../../components/HomeNavigation";
import { OnboardingPanel } from "../../components/OnboardingPanel";
import type { PanelIcon } from "../../components/OnboardingPanel";

type ConversationPanelProps = { title: string; description?: string; icon?: PanelIcon; children: ReactNode; onHome: () => void; showNavigation?: boolean; hideText?: boolean; hideIcon?: boolean };

export function ConversationPanel({ title, description = " ", icon = "orb", children, onHome, showNavigation = true, hideText = false, hideIcon = false }: ConversationPanelProps) {
  const [section, setSection] = useState<HomeSection>("Home");
  const handleNavigate = (next: HomeSection) => {
    setSection(next);
    if (next === "Home") onHome();
  };
  return <OnboardingPanel icon={icon} frameOrb={icon === "orb"} title={title} description={description} hideText={hideText} hideIcon={hideIcon} footer={showNavigation ? <HomeNavigation active={section} onNavigate={handleNavigate} /> : undefined}>
    {children}
  </OnboardingPanel>;
}
