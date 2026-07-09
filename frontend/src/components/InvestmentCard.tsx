
import { useMemo } from 'react';
import { Transaction, Wallet } from '@/types';

interface Props {
  transactions: Transaction[];
  wallets?: Wallet[];
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return n.toLocaleString('id-ID');
}
function fmtFull(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const PLATFORMS = [
  { key: 'bibit'    as const, label: 'Bibit',    sub: 'Reksa Dana', color: 'var(--laccent)', soft: 'var(--accent-soft)' },
  { key: 'stockbit' as const, label: 'Stockbit', sub: 'Saham',      color: 'var(--warn)',    soft: 'var(--warn-soft)'   },
];

function matchPlatform(t: Transaction): 'bibit' | 'stockbit' | null {
  const name = (t.wallet_name ?? '').toLowerCase();
  if (name.includes('bibit'))    return 'bibit';
  if (name.includes('stockbit')) return 'stockbit';
  return null;
}

interface PlatformMonth { buy: number; sell: number }
interface MonthEntry {
  ym: string;
  bibit: PlatformMonth;
  stockbit: PlatformMonth;
  totalBuy: number;
}

export default function InvestmentCard({ transactions, wallets }: Props) {
  const { months, totals } = useMemo(() => {
    const map = new Map<string, { bibit: PlatformMonth; stockbit: PlatformMonth }>();

    for (const t of transactions) {
      const platform = matchPlatform(t);
      if (!platform) continue;
      const ym = t.date.substring(0, 7);
      if (!map.has(ym)) map.set(ym, { bibit: { buy: 0, sell: 0 }, stockbit: { buy: 0, sell: 0 } });
      const entry = map.get(ym)![platform];
      if (t.type === 'expense') entry.buy  += t.amount;
      else                      entry.sell += t.amount;
    }

    const months: MonthEntry[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => ({ ym, ...v, totalBuy: v.bibit.buy + v.stockbit.buy }));

    const totals = {
      bibit:    { buy: 0, sell: 0 },
      stockbit: { buy: 0, sell: 0 },
    };
    for (const m of months) {
      totals.bibit.buy    += m.bibit.buy;
      totals.bibit.sell   += m.bibit.sell;
      totals.stockbit.buy  += m.stockbit.buy;
      totals.stockbit.sell += m.stockbit.sell;
    }

    return { months, totals };
  }, [transactions]);

  const walletMap = useMemo(() => {
    const m: Record<'bibit' | 'stockbit', Wallet | undefined> = { bibit: undefined, stockbit: undefined };
    if (!wallets) return m;
    for (const w of wallets) {
      const n = w.name.toLowerCase();
      if (n.includes('bibit')) m.bibit = w;
      else if (n.includes('stockbit')) m.stockbit = w;
    }
    return m;
  }, [wallets]);

  if (months.length === 0) return null;

  const maxBuy = Math.max(...months.map(m => m.totalBuy), 1);
  const latest = months[months.length - 1];
  const grandNet =
    (totals.bibit.buy - totals.bibit.sell) +
    (totals.stockbit.buy - totals.stockbit.sell);

  const totalPortfolio =
    (walletMap.bibit?.balance ?? 0) + (walletMap.stockbit?.balance ?? 0);

  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid var(--card-border)',
      borderRadius: 18,
      padding: '22px 24px',
      // backdrop removed
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>Investasi Bulanan</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          {totalPortfolio !== 0 ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Total portfolio</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>
                {fmtFull(totalPortfolio)}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Net invested</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: grandNet >= 0 ? 'var(--laccent)' : 'var(--neg)' }}>
                {fmtFull(grandNet)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        {PLATFORMS.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
              {p.label} <span style={{ color: 'var(--fg-subtle)' }}>({p.sub})</span>
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--neg)', flexShrink: 0, opacity: 0.6 }} />
          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Jual</span>
        </div>
      </div>

      {/* Monthly rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {months.map(({ ym, bibit, stockbit, totalBuy }) => {
          const [year, mm] = ym.split('-');
          const label = `${MONTH_LABELS[mm]} ${year}`;
          const isLatest = ym === latest.ym;
          const bibitPct   = (bibit.buy   / maxBuy) * 100;
          const stockbitPct = (stockbit.buy / maxBuy) * 100;
          const totalSell = bibit.sell + stockbit.sell;

          return (
            <div key={ym}>
              {/* Buy bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <div style={{
                  width: 52, fontSize: 11, fontWeight: isLatest ? 700 : 500,
                  color: isLatest ? 'var(--fg)' : 'var(--fg-muted)', flexShrink: 0,
                }}>
                  {label}
                </div>
                <div style={{ flex: 1, position: 'relative', height: 20, background: 'var(--surface-subtle)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${bibitPct}%`,
                    background: 'var(--laccent)',
                    opacity: isLatest ? 1 : 0.55,
                    borderRadius: stockbit.buy > 0 ? '6px 0 0 6px' : 6,
                    transition: 'width 0.4s ease',
                  }} />
                  {stockbit.buy > 0 && (
                    <div style={{
                      position: 'absolute', left: `${bibitPct}%`, top: 0, bottom: 0,
                      width: `${stockbitPct}%`,
                      background: 'var(--warn)',
                      opacity: isLatest ? 1 : 0.55,
                      borderRadius: bibitPct > 0 ? '0 6px 6px 0' : 6,
                      transition: 'width 0.4s ease',
                    }} />
                  )}
                </div>
                <div style={{
                  width: 60, fontSize: 12, fontWeight: isLatest ? 700 : 500,
                  color: isLatest ? 'var(--fg)' : 'var(--fg-muted)',
                  textAlign: 'right', flexShrink: 0,
                }}>
                  {fmt(totalBuy)}
                </div>
              </div>

              {/* Detail row */}
              <div style={{ paddingLeft: 62, display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
                {bibit.buy > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                    Bibit <span style={{ color: 'var(--laccent)', fontWeight: 600 }}>{fmt(bibit.buy)}</span>
                  </span>
                )}
                {stockbit.buy > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                    Stockbit <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{fmt(stockbit.buy)}</span>
                  </span>
                )}
                {totalSell > 0 && (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                      Jual <span style={{ color: 'var(--neg)', fontWeight: 600 }}>{fmt(totalSell)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-platform footer */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PLATFORMS.map(p => {
          const t = totals[p.key];
          const net = t.buy - t.sell;
          const wallet = walletMap[p.key];
          return (
            <div key={p.key} style={{
              padding: '10px 12px', borderRadius: 10,
              background: p.soft, border: '1px solid var(--card-border)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 6 }}>
                {p.label} · {p.sub}
              </div>
              {wallet && wallet.balance > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}>Nilai</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{fmt(wallet.balance)}</span>
                </div>
              )}
              {wallet?.gain_amt != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--fg-subtle)' }}>Keuntungan</span>
                  <span style={{ color: wallet.gain_amt >= 0 ? 'var(--laccent)' : 'var(--neg)', fontWeight: 600 }}>
                    +{fmtFull(wallet.gain_amt)}
                    {wallet.gain_pct != null && (
                      <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>({wallet.gain_pct.toFixed(2)}%)</span>
                    )}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: wallet ? '1px solid var(--card-border)' : 'none', paddingTop: wallet ? 6 : 0, marginTop: wallet ? 4 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--fg-subtle)' }}>Beli</span>
                  <span style={{ color: p.color, fontWeight: 600 }}>{fmt(t.buy)}</span>
                </div>
                {t.sell > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--fg-subtle)' }}>Jual</span>
                    <span style={{ color: 'var(--neg)', fontWeight: 600 }}>{fmt(t.sell)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 12,
                  borderTop: '1px solid var(--card-border)', marginTop: 4, paddingTop: 4,
                }}>
                  <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}>Net</span>
                  <span style={{ color: net >= 0 ? p.color : 'var(--neg)', fontWeight: 700 }}>{fmt(net)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
