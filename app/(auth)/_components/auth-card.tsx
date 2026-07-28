import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="p-6 sm:p-8">
        <header className="mb-7 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </header>
        {children}
      </div>
    </Card>
  );
}

export { AuthCard };
