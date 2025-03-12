import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  if (user) {
    setLocation("/");
    return null;
  }
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Панель управления DDoS</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(data => loginMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Логин</FormLabel>
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
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Вход..." : "Войти"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="flex-1 bg-primary p-6 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="w-24 h-24 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Панель управления DDoS</h1>
          <p className="text-lg max-w-md mx-auto">
            Централизованное управление атаками с поддержкой множества серверов и методов
          </p>
        </div>
      </div>
    </div>
  );
}