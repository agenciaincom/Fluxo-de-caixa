import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background text-center px-4">
      <AlertCircle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-4xl font-serif font-bold text-primary mb-2">404</h1>
      <p className="text-xl text-muted-foreground font-medium mb-8">Página não encontrada</p>
      <Link href="/dashboard">
        <Button className="bg-primary text-primary-foreground">Voltar ao Início</Button>
      </Link>
    </div>
  );
}