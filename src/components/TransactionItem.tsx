import { Badge } from "@/components/ui/badge";

interface TransactionItemProps {
  name: string;
  amount: number;
  time: string;
  category?: string;
  type?: "debit" | "credit";
}

const categoryIcons: Record<string, string> = {
  Food: "🍕",
  Groceries: "🛒",
  Travel: "🚕",
  Shopping: "🛍️",
  Bills: "📄",
  Entertainment: "🎬",
};

const TransactionItem = ({ name, amount, time, category, type = "debit" }: TransactionItemProps) => {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2);
  const emoji = category ? categoryIcons[category] || "💳" : "💳";

  return (
    <div className="flex items-center gap-3 py-3.5 px-4 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer">
      <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0 text-lg">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{time}</p>
        {category && (
          <Badge variant="secondary" className="mt-1.5 text-[10px] px-2 py-0 font-medium rounded-full">
            {category}
          </Badge>
        )}
      </div>
      <span className={`text-sm font-bold whitespace-nowrap ${type === "credit" ? "text-emerald-500" : "text-red-500"}`}>
        {type === "credit" ? "+" : "-"} ₹{Math.abs(amount).toLocaleString('en-IN')}
      </span>
    </div>
  );
};

export default TransactionItem;
