import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, Activity, List } from "lucide-react";
import { NavigationBar } from "@/components/ui/navigation-bar";
export default function HomePage() {
  const { user } = useAuth();
  const { data: servers } = useQuery({
    queryKey: ["/api/servers"],
  });
  const { data: attacks } = useQuery({
    queryKey: ["/api/attacks"],
  });
  const { data: proxies } = useQuery({
    queryKey: ["/api/proxies"],
  });
  const runningAttacks = attacks?.filter(attack => attack.status === "running") || [];
  const onlineServers = servers?.filter(server => server.status === "online") || [];
  const activeProxies = proxies?.filter(proxy => proxy.status === "active") || [];
  return (
    <div>
      <NavigationBar />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Панель управления</h1>
          <div className="text-sm text-muted-foreground">
            Администратор: {user?.username}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Серверы</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineServers.length} / {servers?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Активных серверов</p>
              <Button asChild className="w-full mt-4">
                <Link href="/servers">Управление серверами</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Активные атаки</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runningAttacks.length}</div>
              <p className="text-xs text-muted-foreground">Запущенных атак</p>
              <Button asChild className="w-full mt-4">
                <Link href="/attacks">Управление атаками</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Прокси</CardTitle>
              <List className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProxies.length} / {proxies?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Активных прокси</p>
              <Button asChild className="w-full mt-4">
                <Link href="/proxies">Управление прокси</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}