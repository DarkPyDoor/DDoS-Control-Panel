import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertProxySchema, type Proxy } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { Slider } from '@mui/material';
export default function ProxiesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [checkStatus, setCheckStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState(null);
  const [maxResponseTime, setMaxResponseTime] = useState<number>(500);
  useEffect(() => {
    const savedValue = localStorage.getItem('proxyMaxResponseTime');
    if (savedValue) {
      setMaxResponseTime(parseInt(savedValue));
    }
  }, []);
  useEffect(() => {
    const handleMaxResponseTimeChange = (event: any) => {
      if (event.detail && typeof event.detail.maxResponseTime === 'number') {
        setMaxResponseTime(event.detail.maxResponseTime);
        localStorage.setItem('proxyMaxResponseTime', event.detail.maxResponseTime.toString());
      }
    };
    window.addEventListener('proxyMaxResponseTimeChanged', handleMaxResponseTimeChange);
    return () => window.removeEventListener('proxyMaxResponseTimeChanged', handleMaxResponseTimeChange);
  }, []);
  const { data: proxies, isLoading } = useQuery<Proxy[]>({
    queryKey: ["/api/proxies"],
  });
  const form = useForm({
    resolver: zodResolver(insertProxySchema),
    defaultValues: {
      type: "HTTP",
      host: "",
      port: 80,
      username: "",
      password: "",
    },
  });
  const createMutation = useMutation({
    mutationFn: async (data: { type: string; host: string; port: number; username?: string; password?: string }) => {
      const res = await apiRequest("POST", "/api/proxies", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proxies"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Прокси добавлен",
        description: "Новый прокси успешно добавлен в систему",
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/proxies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proxies"] });
      toast({
        title: "Прокси удален",
        description: "Прокси успешно удален из системы",
      });
    },
  });
  const loadFromUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/proxies/load-url", { url });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proxies"] });
      toast({
        title: "Прокси загружены",
        description: "Прокси успешно загружены из URL",
      });
    },
  });
  const checkProxiesMutation = useMutation({
    mutationFn: async () => {
      setCheckStatus('checking');
      setStatusMessage("Проверка прокси начата");
      const res = await apiRequest("POST", "/api/proxies/check", {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxResponseTime }),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proxies"] });
      toast({
        title: "Проверка завершена",
        description: "Все прокси проверены",
      });
      setCheckStatus('completed');
      setStatusMessage("Проверка прокси завершена");
    },
    onError: (error) => {
      console.error("Error checking proxies:", error);
      setCheckStatus('idle');
      setStatusMessage(null);
    },
  });
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await apiRequest("POST", "/api/proxies/upload", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/proxies"] });
      toast({
        title: "Файл загружен",
        description: "Прокси успешно импортированы из файла",
      });
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить файл с прокси",
        variant: "destructive",
      });
    }
  };
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}
    ws.onopen = () => {
      console.log('WebSocket соединение установлено');
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'proxies') {
        queryClient.setQueryData(["/api/proxies"], message.data);
      }
    };
    ws.onclose = (event) => {
      console.log(`WebSocket закрыт. Код: ${event.code}, Причина: ${event.reason}`);
    };
    return () => ws.close();
  }, []);
  if (isLoading) {
    return (
      <div>
        <NavigationBar />
        <div className="container mx-auto p-6">Loading proxies...</div>
      </div>
    );
  }
  if (!proxies || proxies.length === 0) {
    return (
      <div>
        <NavigationBar />
        <div className="container mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Управление прокси</h1>
          <p>No proxies available</p>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => checkProxiesMutation.mutate()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Проверить все
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить прокси
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Добавить прокси</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="manual">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">Вручную</TabsTrigger>
                    <TabsTrigger value="file">Из файла</TabsTrigger>
                    <TabsTrigger value="url">Из URL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Тип</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Выберите тип" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="HTTP">HTTP</SelectItem>
                                  <SelectItem value="SOCKS4">SOCKS4</SelectItem>
                                  <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Хост</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="127.0.0.1" />
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
                              <FormLabel>Порт</FormLabel>
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
                              <FormLabel>Имя пользователя (опционально)</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                              <FormLabel>Пароль (опционально)</FormLabel>
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
                  </TabsContent>
                  <TabsContent value="file">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Загрузите файл со списком прокси. Формат: ip:port или ip:port:username:password
                      </p>
                      <Input type="file" accept=".txt" onChange={handleFileUpload} />
                    </div>
                  </TabsContent>
                  <TabsContent value="url">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(data => loadFromUrlMutation.mutate(data.host))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL списка прокси</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https:
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={loadFromUrlMutation.isPending}>
                          {loadFromUrlMutation.isPending ? "Загрузка..." : "Загрузить"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <NavigationBar />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Управление прокси</h1>
          <div className="flex gap-2">
            <Button onClick={() => checkProxiesMutation.mutate()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Проверить все
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить прокси
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Добавить прокси</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="manual">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">Вручную</TabsTrigger>
                    <TabsTrigger value="file">Из файла</TabsTrigger>
                    <TabsTrigger value="url">Из URL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Тип</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Выберите тип" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="HTTP">HTTP</SelectItem>
                                  <SelectItem value="SOCKS4">SOCKS4</SelectItem>
                                  <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Хост</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="127.0.0.1" />
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
                              <FormLabel>Порт</FormLabel>
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
                              <FormLabel>Имя пользователя (опционально)</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                              <FormLabel>Пароль (опционально)</FormLabel>
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
                  </TabsContent>
                  <TabsContent value="file">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Загрузите файл со списком прокси. Формат: ip:port или ip:port:username:password
                      </p>
                      <Input type="file" accept=".txt" onChange={handleFileUpload} />
                    </div>
                  </TabsContent>
                  <TabsContent value="url">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(data => loadFromUrlMutation.mutate(data.host))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL списка прокси</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https:
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={loadFromUrlMutation.isPending}>
                          {loadFromUrlMutation.isPending ? "Загрузка..." : "Загрузить"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="mb-4">
          <p>Максимальное время отклика (мс): {maxResponseTime}</p>
          <Slider
            aria-label="Максимальное время отклика"
            defaultValue={500}
            min={100}
            max={1000}
            step={100}
            valueLabelDisplay="auto"
            onChange={(event, newValue) => {
              setMaxResponseTime(newValue as number);
              localStorage.setItem('proxyMaxResponseTime', (newValue as number).toString());
              const event2 = new CustomEvent('proxyMaxResponseTimeChanged', { detail: { maxResponseTime: newValue } });
              window.dispatchEvent(event2);
            }}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {proxies.map((proxy) => (
            <Card key={proxy.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium">{proxy.type}</h3>
                    <p className="text-sm text-muted-foreground">
                      {proxy.host}:{proxy.port}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить прокси?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Это действие нельзя отменить. Прокси будет удален из системы.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(proxy.id)}>
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${proxy.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm">
                    {proxy.status === "active" ? "Активен" : "Неактивен"}
                  </span>
                </div>
                {proxy.username && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Пользователь: {proxy.username}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}