import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavigationBar } from "@/components/ui/navigation-bar";
const settingsSchema = z.object({
  username: z.string().min(1, "Введите новый логин"),
  password: z.string().min(1, "Введите новый пароль"),
});
type FormData = z.infer<typeof settingsSchema>;
export default function SettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(settingsSchema),
  });
  const updateCredentials = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/settings/credentials", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Учетные данные обновлены",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  return (
    <div>
      <NavigationBar />
      <div className="container mx-auto p-6">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form 
                  onSubmit={form.handleSubmit(data => updateCredentials.mutate(data))} 
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Новый логин</FormLabel>
                        <FormControl>
                          <Input {...field} type="text" />
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
                        <FormLabel>Новый пароль</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={updateCredentials.isPending}
                  >
                    {updateCredentials.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}