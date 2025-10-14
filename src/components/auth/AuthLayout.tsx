import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-hero bg-clip-text text-transparent">
            CentralPay PT
          </h1>
          <p className="text-muted-foreground mt-2">
            Centralize todas as suas faturas num só lugar
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
