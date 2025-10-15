import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  variant?: "default" | "warning" | "success" | "danger";
}

export function StatsCard({ title, value, description, icon: Icon, variant = "default" }: StatsCardProps) {
  const variantClasses = {
    default: {
      icon: "text-primary bg-primary/10",
      border: "border-primary/20 hover:border-primary/40",
      glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
    },
    warning: {
      icon: "text-warning bg-warning/10",
      border: "border-warning/20 hover:border-warning/40",
      glow: "hover:shadow-[0_0_20px_rgba(251,191,36,0.1)]"
    },
    success: {
      icon: "text-success bg-success/10",
      border: "border-success/20 hover:border-success/40",
      glow: "hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]"
    },
    danger: {
      icon: "text-destructive bg-destructive/10",
      border: "border-destructive/20 hover:border-destructive/40",
      glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    },
  };

  const styles = variantClasses[variant];

  return (
    <Card className={cn(
      "transition-all duration-300 border-2 relative overflow-hidden group",
      styles.border,
      styles.glow
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn(
          "p-2 rounded-lg transition-transform duration-300 group-hover:scale-110",
          styles.icon
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
