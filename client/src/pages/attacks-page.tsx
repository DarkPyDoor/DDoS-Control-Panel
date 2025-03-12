import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertAttackSchema, type Attack, type Server, L4_METHODS, L7_METHODS } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Activity, Clock, Server as ServerIcon } from "lucide-react";
import { format, addSeconds } from "date-fns";
import { NavigationBar } from "@/components/ui/navigation-bar";
export default function AttacksPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<"L4" | "L7" | null>(null);
  const [attackStatuses, setAttackStatuses] = useState<Record<number, string>>({});
  const { data: attacks, isLoading: isAttacksLoading, error: attacksError } = useQuery<Attack[]>({
    queryKey: ["/api/attacks"],
  });
  const { data: servers, isLoading: isServersLoading } = useQuery<Server[]>({
    queryKey: ["/api/servers"],
  });
  const methods = useMemo(() => {
    return selectedLayer === "L4" ? L4_METHODS :
           selectedLayer === "L7" ? L7_METHODS :
           [];
  }, [selectedLayer]);
  const form = useForm({
    resolver: zodResolver(insertAttackSchema),
    defaultValues: {
      target: "",
      method: "",
      layer: "L4" as const,
      duration: 30,
      threads: 100,
      rpc: 100,
      useProxy: false,
      serverIds: "",
    },
  });
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/attacks", data);
      return await res.json();
    },
    onSuccess: (newAttack) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attacks"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Атака запущена",
        description: "Атака успешно запущена на выбранную цель",
      });
      setAttackStatuses(prev => ({ ...prev, [newAttack.id]: "running" }));
    },
    onError: (error: any) => {
      console.error("Ошибка при запуске атаки:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось запустить атаку",
        variant: "destructive",
      });
    },
  });
  const stopMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/attacks/${id}/stop`);
      return await res.json();
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attacks"] });
      setAttackStatuses(prev => ({ ...prev, [id]: "stopped" }));
      toast({
        title: "Атака остановлена",
        description: "Атака успешно остановлена на всех серверах",
      });
    },
    onError: (error: any) => {
      console.error("Ошибка при остановке атаки:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось остановить атаку",
        variant: "destructive",
      });
    },
  });
  useEffect(() => {
    if (!attacks) return;
    attacks.forEach(attack => {
      if (attack.status === "running" && !attackStatuses[attack.id]) {
        setAttackStatuses(prev => ({ ...prev, [attack.id]: "running" }));
      }
      const startTime = new Date(attack.startedAt || Date.now()).getTime();
      const durationMs = attack.duration * 1000;
      const endTime = startTime + durationMs;
      const now = Date.now();
      if (attack.status === "running" && now < endTime) {
        const timeout = setTimeout(() => {
          setAttackStatuses(prev => ({ ...prev, [attack.id]: "stopped" }));
          queryClient.invalidateQueries({ queryKey: ["/api/attacks"] });
        }, endTime - now);
        return () => clearTimeout(timeout);
      }
    });
  }, [attacks]);
  const formatDate = (date?: string | Date | null) => {
    try {
      const parsedDate = date ? new Date(date) : new Date();
      if (isNaN(parsedDate.getTime())) throw new Error("Invalid date");
      return format(parsedDate, "dd.MM.yyyy HH:mm");
    } catch {
      return format(new Date(), "dd.MM.yyyy HH:mm");
    }
  };
  const getEndTime = (startedAt?: string | Date | null, duration: number = 0) => {
    try {
      const start = startedAt ? new Date(startedAt) : new Date();
      if (isNaN(start.getTime())) throw new Error("Invalid date");
      const end = addSeconds(start, duration);
      return format(end, "dd.MM.yyyy HH:mm");
    } catch {
      const now = new Date();
      return format(addSeconds(now, duration), "dd.MM.yyyy HH:mm");
    }
  };
  if (isAttacksLoading || isServersLoading) {
    return (
      <div>
        <NavigationBar />
        <div className="container mx-auto p-6">Loading attacks...</div>
      </div>
    );
  }
  if (attacksError) {
    return (
      <div>
        <NavigationBar />
        <div className="container mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Управление атаками</h1>
          <p>Error loading attacks: {attacksError.message}</p>
        </div>
      </div>
    );
  }
  if (!attacks || attacks.length === 0) {
    return (
      <div>
        <NavigationBar />
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold">Управление атаками</h1>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Новая атака
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Запустить новую атаку</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="target"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Цель</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https:
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="layer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Уровень</FormLabel>
                          <Select
                            onValueChange={(value: "L4" | "L7") => {
                              field.onChange(value);
                              setSelectedLayer(value);
                              form.setValue("method", "");
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите уровень" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="L4">Layer 4</SelectItem>
                              <SelectItem value="L7">Layer 7</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Метод</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите метод" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {methods.map(method => (
                                <SelectItem key={method} value={method}>
                                  {method}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Длительность (секунды)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="120" 
                              {...field} 
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="threads"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Потоки</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="1" 
                              max="500" 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rpc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RPC (запросов в секунду)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="1" 
                              max="400" 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="serverIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Серверы</FormLabel>
                          <div className="space-y-2">
                            {servers?.length ? (
                              servers.map(server => (
                                <div key={server.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`server-${server.id}`}
                                    checked={field.value.split(',').includes(server.id.toString())}
                                    onCheckedChange={(checked) => {
                                      const currentIds = field.value ? field.value.split(',').filter(Boolean) : [];
                                      const newIds = checked
                                        ? [...currentIds, server.id.toString()]
                                        : currentIds.filter(id => id !== server.id.toString());
                                      field.onChange(newIds.join(','));
                                    }}
                                  />
                                  <label htmlFor={`server-${server.id}`}>
                                    {server.name} ({server.host})
                                  </label>
                                </div>
                              ))
                            ) : (
                              <p>No servers available</p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="useProxy"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Использовать прокси</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Запуск..." : "Запустить"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <p>No attacks available</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <NavigationBar />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Управление атаками</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Новая атака
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Запустить новую атаку</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="target"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Цель</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https:
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="layer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Уровень</FormLabel>
                        <Select
                          onValueChange={(value: "L4" | "L7") => {
                            field.onChange(value);
                            setSelectedLayer(value);
                            form.setValue("method", "");
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите уровень" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="L4">Layer 4</SelectItem>
                            <SelectItem value="L7">Layer 7</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Метод</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите метод" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {methods.map(method => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Длительность (секунды)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="120" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="threads"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Потоки</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="1" 
                            max="500" 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rpc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RPC (запросов в секунду)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="1" 
                            max="400" 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serverIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Серверы</FormLabel>
                        <div className="space-y-2">
                          {servers?.length ? (
                            servers.map(server => (
                              <div key={server.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`server-${server.id}`}
                                  checked={field.value.split(',').includes(server.id.toString())}
                                  onCheckedChange={(checked) => {
                                    const currentIds = field.value ? field.value.split(',').filter(Boolean) : [];
                                    const newIds = checked
                                      ? [...currentIds, server.id.toString()]
                                      : currentIds.filter(id => id !== server.id.toString());
                                    field.onChange(newIds.join(','));
                                  }}
                                />
                                <label htmlFor={`server-${server.id}`}>
                                  {server.name} ({server.host})
                                </label>
                              </div>
                            ))
                          ) : (
                            <p>No servers available</p>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="useProxy"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Использовать прокси</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Запуск..." : "Запустить"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {attacks.map((attack) => {
            console.log("Attack data:", attack); 
            const effectiveStatus = attackStatuses[attack.id] || attack.status;
            const isRunning = effectiveStatus === "running";
            return (
              <Card key={attack.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className={isRunning ? "text-green-500" : "text-red-500"} />
                      <span className="font-medium">{isRunning ? "Активна" : "Завершена"}</span>
                    </div>
                    {isRunning && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stopMutation.mutate(attack.id)}
                        disabled={stopMutation.isPending}
                      >
                        Остановить
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <ServerIcon className="w-4 h-4" />
                      <span>
                        Серверы: {attack.serverIds.split(',').map(id =>
                          servers?.find(s => s.id === parseInt(id))?.name || id
                        ).join(', ')}
                      </span>
                    </div>
                    <div>Цель: {attack.target}</div>
                    <div>Уровень: {attack.layer}</div>
                    <div>Метод: {attack.method}</div>
                    <div>Потоки: {attack.threads}</div>
                    <div>RPC: {attack.rpc}</div>
                    <div>Прокси: {attack.useProxy ? "Да" : "Нет"}</div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <div>
                        <div>Запущена: {formatDate(attack.startedAt)}</div>
                        <div>Окончание: {getEndTime(attack.startedAt, attack.duration)}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}