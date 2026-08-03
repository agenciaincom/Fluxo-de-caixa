import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEffect, useRef } from 'react';

import NotFound from '@/pages/not-found';
import { Layout } from '@/components/layout';
import HomePage from '@/pages/home';
import DashboardPage from '@/pages/dashboard';
import AvisosPage from '@/pages/avisos';
import EntradasPage from '@/pages/entradas';
import SaidasPage from '@/pages/saidas';
import RelatorioPage from '@/pages/relatorio';
import ScanPage from '@/pages/scan';
import AssinaturaPage from '@/pages/assinatura';
import ConciliacaoPage from '@/pages/conciliacao';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#C99A2E",
    colorForeground: "#0B1C42",
    colorMutedForeground: "#6B7BA4",
    colorDanger: "#ef4444",
    colorBackground: "#F6F1E4",
    colorInput: "#EDE9DF",
    colorInputForeground: "#0B1C42",
    colorNeutral: "#C8BFA8",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#F6F1E4] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-[#C8BFA8]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#0B1C42] font-serif",
    headerSubtitle: "text-[#6B7BA4]",
    socialButtonsBlockButtonText: "text-[#0B1C42]",
    formFieldLabel: "text-[#0B1C42]",
    footerActionLink: "text-[#C99A2E]",
    footerActionText: "text-[#6B7BA4]",
    dividerText: "text-[#6B7BA4]",
    identityPreviewEditButton: "text-[#C99A2E]",
    formFieldSuccessText: "text-green-600",
    alertText: "text-[#0B1C42]",
    logoBox: "mb-2",
    socialButtonsBlockButton: "border border-[#C8BFA8] bg-white hover:bg-[#F6F1E4]",
    formButtonPrimary: "bg-[#0B1C42] hover:bg-[#0B1C42]/90 text-white",
    formFieldInput: "border-[#C8BFA8] bg-white text-[#0B1C42]",
    footerAction: "border-t border-[#C8BFA8]",
    dividerLine: "bg-[#C8BFA8]",
    alert: "border-[#C8BFA8]",
    otpCodeFieldInput: "border-[#C8BFA8]",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: '#F6F1E4' }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: '#F6F1E4' }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const res = await fetch('/api/billing/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao verificar assinatura');
      return res.json() as Promise<{ active: boolean }>;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#6B7BA4]">
        Carregando...
      </div>
    );
  }

  if (!data?.active) {
    return <AssinaturaPage />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <RequireSubscription>
            <Component />
          </RequireSubscription>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ProtectedRouteNoGate({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Bem-vindo de volta",
            subtitle: "Acesse sua conta do Fluxo de Caixa",
          },
        },
        signUp: {
          start: {
            title: "Crie sua conta",
            subtitle: "Comece a organizar seu financeiro",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
            <Route path="/avisos" component={() => <ProtectedRoute component={AvisosPage} />} />
            <Route path="/entradas" component={() => <ProtectedRoute component={EntradasPage} />} />
            <Route path="/saidas" component={() => <ProtectedRoute component={SaidasPage} />} />
            <Route path="/relatorio" component={() => <ProtectedRoute component={RelatorioPage} />} />
            <Route path="/scan" component={() => <ProtectedRoute component={ScanPage} />} />
            <Route path="/conciliacao" component={() => <ProtectedRouteNoGate component={ConciliacaoPage} />} />

            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
