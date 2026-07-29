import { useState } from 'react';

export default function AssinaturaPage() {
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null);

  const assinar = async (period: 'monthly' | 'annual') => {
    setLoading(period);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(null);
      }
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4" style={{ background: '#F6F1E4' }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-[#C8BFA8] p-8 text-center">
        <h1 className="text-2xl font-bold text-[#0B1C42] mb-2">Assine o Fluxo de Caixa</h1>
        <p className="text-[#6B7BA4] mb-6">
          7 dias grátis para testar. Depois, continue por um valor acessível.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => assinar('monthly')}
            disabled={loading !== null}
            className="bg-[#0B1C42] hover:bg-[#0B1C42]/90 text-white rounded-lg py-3 font-semibold disabled:opacity-60"
          >
            {loading === 'monthly' ? 'Carregando...' : 'Mensal — R$ 69,90/mês'}
          </button>
          <button
            onClick={() => assinar('annual')}
            disabled={loading !== null}
            className="border border-[#0B1C42] text-[#0B1C42] rounded-lg py-3 font-semibold disabled:opacity-60"
          >
            {loading === 'annual' ? 'Carregando...' : 'Anual — equivalente a R$ 59,90/mês'}
          </button>
        </div>
      </div>
    </div>
  );
}
