
import { useState, useRef } from 'react';
import { Wallet, ParsedTx, PreviewMeta } from '@/types';
import { previewStatement, confirmImport } from '@/lib/api';

interface Props {
  wallets: Wallet[];
  userId: number;
  onClose: () => void;
  onDone: () => void;
}

const BANK_LABELS: Record<string, string> = { bca: 'BCA', permata: 'Permata', jago: 'Jago', stockbit: 'Stockbit', dana: 'Dana', shopee: 'ShopeePay' };
const IMAGE_BASED = new Set(['dana', 'shopee']);

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function StatementImportModal({ wallets, userId, onClose, onDone }: Props) {
  const importableWallets = wallets.filter(w => w.bank_type);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [selectedWalletId, setSelectedWalletId] = useState<number | ''>(
    importableWallets.length === 1 ? importableWallets[0].id : ''
  );
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ParsedTx[]>([]);
  const [meta, setMeta] = useState<PreviewMeta>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insertedCount, setInsertedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedWallet = importableWallets.find(w => w.id === selectedWalletId) ?? null;
  const bankType = selectedWallet?.bank_type as 'bca' | 'permata' | 'jago' | 'stockbit' | undefined;

  const handleFilesPick = (picked: FileList | File[]) => {
    const arr = Array.from(picked);
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const fresh = arr.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...fresh];
    });
    setError('');
  };

  const handleRemoveFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleParse = async () => {
    if (!files.length || !bankType || !selectedWallet) return;
    setLoading(true);
    setError('');
    try {
      const result = await previewStatement(selectedWallet.id, bankType, files);
      setRows(result.rows);
      setMeta(result.meta);
      setStep('preview');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to parse. Make sure pdftotext (poppler) is installed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await confirmImport(userId, rows, meta);
      setInsertedCount(result.inserted);
      onDone(); // refresh wallet cards immediately
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save transactions.');
    } finally {
      setLoading(false);
    }
  };

  const transfers = rows.filter(r => r.isTransfer);
  const nonTransferRows = rows.filter(r => !r.isTransfer);
  const income = nonTransferRows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = nonTransferRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const canParse = files.length > 0 && !!selectedWallet;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(3,29,68,0.30)', backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass glass-card" style={{
        width: '100%', maxWidth: 680, maxHeight: '88vh',
        margin: '0 16px', display: 'flex', flexDirection: 'column',
        padding: 0, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div className="eyebrow">Import Statement</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)', marginTop: 3 }}>
              {selectedWallet ? (
                <>
                  {selectedWallet.icon && <span style={{ marginRight: 6 }}>{selectedWallet.icon}</span>}
                  {selectedWallet.name}
                  {bankType && (
                    <span className="chip" style={{ marginLeft: 8, fontSize: 11 }}>
                      {BANK_LABELS[bankType]}
                    </span>
                  )}
                </>
              ) : (
                'Choose a wallet'
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--glass-border)',
            background: 'rgba(255,255,255,0.6)', cursor: 'pointer', color: 'var(--fg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* STEP: upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Wallet selector */}
              {importableWallets.length === 0 ? (
                <div style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(218,183,133,0.12)', border: '1px solid rgba(218,183,133,0.36)',
                  fontSize: 13, color: '#8a6a2e',
                }}>
                  No wallets with a bank type found. Edit a wallet and set it to BCA, Permata, Jago, or Stockbit first.
                </div>
              ) : (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Select wallet</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {importableWallets.map(w => {
                      const selected = selectedWalletId === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() => setSelectedWalletId(w.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                            border: selected
                              ? '1.5px solid var(--laccent)'
                              : '1px solid var(--glass-border)',
                            background: selected
                              ? 'rgba(4,57,94,0.07)'
                              : 'rgba(255,255,255,0.45)',
                            textAlign: 'left', width: '100%',
                            transition: 'all 0.15s',
                          }}
                        >
                          {w.icon ? (
                            <span style={{ fontSize: 20 }}>{w.icon}</span>
                          ) : (
                            <div style={{
                              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                              background: 'rgba(3,29,68,0.05)', border: '1px solid var(--glass-border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--fg-muted)', fontSize: 14,
                            }}>🏦</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{w.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>
                              {BANK_LABELS[w.bank_type!]}
                              {w.account_number && ` · ${w.account_number}`}
                            </div>
                          </div>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                            border: selected ? '4px solid var(--laccent)' : '1.5px solid var(--glass-border-hi)',
                            background: selected ? 'var(--laccent)' : 'transparent',
                            transition: 'all 0.15s',
                          }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Drop zone */}
              {importableWallets.length > 0 && (() => {
                const isPdfBank = selectedWallet ? !IMAGE_BASED.has(selectedWallet.bank_type!) : true;
                // All banks accept both PDF and image — images are routed to OCR on the backend
                const acceptAttr = 'application/pdf,image/jpeg,image/png,image/webp';
                const formatHint = isPdfBank ? 'PDF or screenshot' : 'PNG / JPG screenshot';
                const fallbackHint = 'any supported bank';
                const dropIcon = '📄';
                return (
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Upload statement</div>
                    {/* Drop zone */}
                    <div
                      onClick={() => inputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        if (e.dataTransfer.files.length) handleFilesPick(e.dataTransfer.files);
                      }}
                      style={{
                        border: `2px dashed ${files.length ? 'rgba(112,162,136,0.50)' : 'var(--glass-border-hi)'}`,
                        borderRadius: 16, padding: '28px 24px',
                        textAlign: 'center', cursor: 'pointer',
                        background: files.length ? 'rgba(112,162,136,0.05)' : 'rgba(255,255,255,0.3)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{dropIcon}</div>
                      {files.length ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pos)' }}>
                            {files.length} file{files.length > 1 ? 's' : ''} selected
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginTop: 4 }}>
                            click to add more
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>
                            Drop statements or screenshots here
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginTop: 4 }}>
                            {formatHint} · {selectedWallet ? BANK_LABELS[bankType!] : fallbackHint} · multiple files ok
                          </div>
                        </>
                      )}
                      <input
                        ref={inputRef}
                        type="file"
                        accept={acceptAttr}
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => { if (e.target.files?.length) handleFilesPick(e.target.files); e.target.value = ''; }}
                      />
                    </div>

                    {/* File list with remove buttons */}
                    {files.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {files.map((f, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.5)', border: '1px solid var(--glass-border)',
                          }}>
                            <span style={{ fontSize: 14 }}>{f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                                {(f.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleRemoveFile(i); }}
                              style={{
                                width: 22, height: 22, borderRadius: 6, border: '1px solid var(--glass-border)',
                                background: 'rgba(213,137,111,0.10)', color: 'var(--neg)',
                                cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {error && (
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(213,137,111,0.10)', border: '1px solid rgba(213,137,111,0.30)',
                  fontSize: 13, color: 'var(--neg)',
                }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary bar */}
              <div style={{
                display: 'flex', gap: 12, flexWrap: 'wrap',
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.5)', border: '1px solid var(--glass-border)',
              }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Transactions</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>
                    {rows.length}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Income</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--pos)' }}>
                    {fmt(income)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Expense</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--neg)' }}>
                    {fmt(expense)}
                  </div>
                </div>
                {transfers.length > 0 && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div className="eyebrow" style={{ marginBottom: 2 }}>Transfers detected</div>
                    <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-muted)' }}>
                      {transfers.length}
                    </div>
                  </div>
                )}
                {meta.closingBalance !== undefined && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div className="eyebrow" style={{ marginBottom: 2 }}>Statement balance</div>
                    <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--laccent)' }}>
                      {fmt(meta.closingBalance)}
                    </div>
                  </div>
                )}
                {meta.gainPct !== undefined && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div className="eyebrow" style={{ marginBottom: 2 }}>Portfolio P&amp;L</div>
                    <div className="num" style={{ fontSize: 16, fontWeight: 600, color: meta.gainPct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {meta.gainPct >= 0 ? '+' : ''}{meta.gainPct.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Transfer info banner */}
              {transfers.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(4,57,94,0.05)', border: '1px solid var(--glass-border)',
                  fontSize: 13, color: 'var(--fg-muted)',
                }}>
                  <span style={{ fontSize: 15 }}>↔</span>
                  {transfers.length} inter-wallet transfer{transfers.length > 1 ? 's' : ''} recorded for audit trail
                  <span style={{ fontSize: 11, color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                    Excluded from income/expense totals
                  </span>
                </div>
              )}

              {/* Transaction table */}
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 100px 70px',
                  gap: 0,
                  background: 'rgba(3,29,68,0.03)',
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--glass-border)',
                }}>
                  {['Date', 'Description', 'Amount', 'Type'].map(h => (
                    <div key={h} className="eyebrow" style={{ fontSize: 10 }}>{h}</div>
                  ))}
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {rows.map((row, i) => (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 100px 70px',
                      gap: 0, padding: '8px 14px',
                      borderBottom: i < rows.length - 1 ? '1px solid var(--glass-border)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.25)',
                      alignItems: 'center',
                    }}>
                      <div className="num" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{row.date}</div>
                      <div style={{
                        fontSize: 12, color: 'var(--fg)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        paddingRight: 8,
                      }} title={row.description}>{row.description}</div>
                      <div className="num" style={{
                        fontSize: 12, fontWeight: 600, textAlign: 'right', paddingRight: 8,
                        color: row.isTransfer ? 'var(--fg-muted)' : row.type === 'income' ? 'var(--pos)' : 'var(--neg)',
                      }}>
                        {row.isTransfer ? '↔' : row.type === 'income' ? '+' : '-'}{fmt(row.amount)}
                      </div>
                      <div>
                        {row.isTransfer
                          ? <span className="chip" style={{ fontSize: 10 }}>transfer</span>
                          : <span className={`chip chip-${row.type === 'income' ? 'pos' : 'neg'}`} style={{ fontSize: 10 }}>{row.type}</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(213,137,111,0.10)', border: '1px solid rgba(213,137,111,0.30)',
                  fontSize: 13, color: 'var(--neg)',
                }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--fg)', marginBottom: 6 }}>
                Import complete
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
                {insertedCount} transaction{insertedCount !== 1 ? 's' : ''} added to your ledger.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--glass-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          {step === 'done' ? (
            <button
              onClick={() => { onDone(); onClose(); }}
              style={{
                height: 36, padding: '0 20px', borderRadius: 999,
                background: 'var(--laccent)', color: '#fff',
                border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Done
            </button>
          ) : (
            <>
              <button onClick={step === 'preview' ? () => setStep('upload') : onClose} style={{
                height: 36, padding: '0 18px', borderRadius: 999,
                background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)',
                color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer',
              }}>
                {step === 'preview' ? 'Back' : 'Cancel'}
              </button>
              <button
                onClick={step === 'upload' ? handleParse : handleConfirm}
                disabled={loading || (step === 'upload' && !canParse)}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 999,
                  background: 'var(--laccent)', color: '#fff',
                  border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  opacity: loading || (step === 'upload' && !canParse) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {loading && (
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                {step === 'upload'
                  ? `Parse ${files.length} file${files.length !== 1 ? 's' : ''}`
                  : `Import ${rows.length} transactions`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
