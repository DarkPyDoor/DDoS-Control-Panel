import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertServerSchema, type Server } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Power, PowerOff } from "lucide-react";
import { NavigationBar } from "@/components/ui/navigation-bar";
export default function ServersPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: servers } = useQuery<Server[]>({
    queryKey: ["/api/servers"],
  });
  const form = useForm({
    resolver: zodResolver(insertServerSchema),
    defaultValues: {
      name: "",
      host: "",
      port: 22,
      username: "",
      password: "",
    },
  });
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; host: string; port: number; username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/servers", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Сервер добавлен",
        description: "Новый сервер успешно добавлен в систему",
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      toast({
        title: "Сервер удален",
        description: "Сервер успешно удален из системы",
      });
    },
  });
  return (
    <div>
      <NavigationBar />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Управление серверами</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Добавить сервер
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить новый сервер</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Сервер 1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP адрес</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="192.168.1.1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSH Порт</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={1} max={65535} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя пользователя</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="root" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Пароль</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Добавление..." : "Добавить"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {servers?.map((server) => (
            <Card key={server.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium">{server.name}</h3>
                    <p className="text-sm text-muted-foreground">{server.host}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить сервер?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Это действие нельзя отменить. Сервер будет удален из системы.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(server.id)}>
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center space-x-2">
                  {server.status === "online" ? (
                    <Power className="w-4 h-4 text-green-500" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {server.status === "online" ? "Онлайн" : "Оффлайн"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}