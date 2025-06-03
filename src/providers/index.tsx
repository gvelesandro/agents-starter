import { ModalProvider } from "@/providers/ModalProvider";
import { TooltipProvider } from "@/providers/TooltipProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <TooltipProvider>
      <NotificationProvider>
        <ModalProvider>{children}</ModalProvider>
      </NotificationProvider>
    </TooltipProvider>
  );
};
