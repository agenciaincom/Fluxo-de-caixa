import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { LayoutDashboard, Bell, TrendingUp, TrendingDown, BarChart2, Camera, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetAvisos } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: avisos } = useGetAvisos();
  const hasAvisos = avisos && (avisos.entradasVencendoAmanha.length > 0 || avisos.saidasVencendoHoje.length > 0 || avisos.saidasVencendoAmanha.length > 0);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Avisos", href: "/avisos", icon: Bell, badge: hasAvisos },
    { name: "Entradas", href: "/entradas", icon: TrendingUp },
    { name: "Saídas", href: "/saidas", icon: TrendingDown },
    { name: "Relatório", href: "/relatorio", icon: BarChart2 },
    { name: "Adicionar por Foto", href: "/scan", icon: Camera },
  ];

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary rounded-md flex items-center justify-center font-serif font-bold text-sidebar-primary-foreground">FC</div>
            <span className="font-serif font-bold text-xl text-sidebar-primary">Fluxo de Caixa</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50'}`}>
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-destructive" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center overflow-hidden">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || "User"} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-sm">{(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'U').toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName || "Usuário"}</p>
              <p className="text-xs text-sidebar-foreground/70 truncate">{user?.emailAddresses?.[0]?.emailAddress}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded-md flex items-center justify-center font-serif font-bold text-sidebar-primary-foreground text-sm">FC</div>
          <span className="font-serif font-bold text-sidebar-primary">Fluxo de Caixa</span>
        </Link>
        <Button variant="ghost" size="icon" className="text-sidebar-foreground" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-sidebar/95 z-40 p-4 flex flex-col backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
          <nav className="flex-1 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-4 px-4 py-4 rounded-md transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground'}`}>
                  <item.icon className="h-6 w-6" />
                  <span className="font-medium text-lg">{item.name}</span>
                  {item.badge && <span className="ml-auto w-2 h-2 rounded-full bg-destructive" />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-4 border-t border-sidebar-border/50">
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground py-6 text-lg" onClick={() => signOut()}>
              <LogOut className="mr-4 h-6 w-6" />
              Sair
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 pb-20 md:pb-0 overflow-y-auto">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-background border-t border-border flex items-center justify-around px-2 z-30 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[
          { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { name: "Avisos", href: "/avisos", icon: Bell, badge: hasAvisos },
          { name: "Scan", href: "/scan", icon: Camera, isPrimary: true },
          { name: "Entradas", href: "/entradas", icon: TrendingUp },
          { name: "Saídas", href: "/saidas", icon: TrendingDown },
        ].map((item) => {
          const isActive = location === item.href;
          if (item.isPrimary) {
            return (
              <Link key={item.name} href={item.href} className="relative -top-5 flex flex-col items-center justify-center p-4 bg-primary text-primary-foreground rounded-full shadow-lg">
                <item.icon className="h-7 w-7" />
              </Link>
            );
          }
          return (
            <Link key={item.name} href={item.href} className={`flex flex-col items-center justify-center w-16 h-full ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="relative">
                <item.icon className="h-6 w-6 mb-1" />
                {item.badge && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background" />}
              </div>
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}