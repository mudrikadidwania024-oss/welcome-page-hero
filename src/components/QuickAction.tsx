import { LucideIcon } from "lucide-react";

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  color?: string;
}

const QuickAction = ({ icon: Icon, label, onClick, color = "text-primary" }: QuickActionProps) => {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 p-2 rounded-2xl hover:bg-muted/80 active:scale-95 transition-all duration-200 group"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/8 group-hover:bg-primary/15 flex items-center justify-center transition-colors duration-200 shadow-sm">
        <Icon className={`w-6 h-6 ${color}`} strokeWidth={1.8} />
      </div>
      <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight max-w-[72px]">{label}</span>
    </button>
  );
};

export default QuickAction;
