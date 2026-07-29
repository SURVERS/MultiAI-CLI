import multiaiLogo from "@/assets/multiai-logo.svg";

export function MultiAILogo({ className }: { className?: string }) {
  return <img src={multiaiLogo} alt="MultiAI" className={className} aria-label="MultiAI" />;
}
