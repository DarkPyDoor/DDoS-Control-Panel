import { useLocation } from "wouter";
import { Button } from "./button";
import { ChevronLeft, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
export function NavigationBar() {
  const [location, setLocation] = useLocation();
  const { logoutMutation } = useAuth();
  const showBackButton = location !== "/";
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            На главную
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setLocation("/settings")}>
          <Settings className="h-4 w-4 mr-2" />
          Настройки
        </Button>
        <Button variant="ghost" onClick={() => logoutMutation.mutate()}>
          <LogOut className="h-4 w-4 mr-2" />
          Выйти
        </Button>
      </div>
    </div>
  );
}