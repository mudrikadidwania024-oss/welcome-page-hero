import { ReactNode } from "react";

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
}

const MobileLayout = ({ children, className = "" }: MobileLayoutProps) => {
  return (
    <div className="flex min-h-screen items-start justify-center bg-background">
      <div className={`w-full max-w-[430px] min-h-screen bg-card shadow-2xl relative ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default MobileLayout;
