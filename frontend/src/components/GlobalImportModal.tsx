
import { useState, useRef, useEffect, useCallback } from 'react';
import { ParsedTx, PreviewMeta, Wallet } from '@/types';
import { autoPreviewStatement, previewStatement, confirmImport, getWallets } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  userId: number;
  onClose: () => void;
  onDone: () => void;
}

const BANK_LABELS: Record<string, string> = {
  bca: 'BCA', permata: 'Permata', jago: 'Jago',
  stockbit: 'Stockbit', dana: 'Dana', shopee: 'ShopeePay', ovo: 'OVO', bibit: 'Bibit', gopay: 'GoPay',
};

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

type ParseState = 'idle' | 'parsing' | 'done' | 'error';
type ConfirmState = 'idle' | 'confirming' | 'done';

export default function GlobalImportModal({ userId, onClose, onDone }: Props) {
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle');
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ParsedTx[]>([]);
  const [meta, setMeta] = useState<PreviewMeta>({});
  const [detectedBank, setDetectedBank] = useState('');
  const [walletName, setWalletName] = useState('');
  const [walletIcon, setWalletIcon] = useState('');
  const [error, setError] = useState('');
  const [insertedCount, setInsertedCount] = useState(0);
  const [fallbackWallets, setFallbackWallets] = useState<Wallet[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWallets(userId).then(ws => {
      setFallbackWallets(ws.filter(w => w.bank_type));
    }).catch(() => {});
  }, [userId]);

  // Keyboard: Enter to confirm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && parseState === 'done' && confirmState === 'idle' && rows.length > 0) {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parseState, confirmState, rows]);

  const handleParse = useCallback(async (fileList: File[]) => {
    if (!fileList.length) return;
    setParseState('parsing');
    setError('');
    setRows([]);
    setMeta({});
    setDetectedBank('');
    setWalletName('');
    setWalletIcon('');
    try {
      const result = await autoPreviewStatement(userId, fileList);
      setRows(result.rows);
      setMeta(result.meta);
      setDetectedBank(result.detectedBank);
      setWalletName(result.walletName);
      setWalletIcon(result.walletIcon ?? '');
      setParseState('done');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to parse statement.');
      setParseState('error');
    }
  }, [userId]);

  const handleFallbackParse = async (wallet: Wallet) => {
    if (!files.length || !wallet.bank_type) return;
    setParseState('parsing');
    setError('');
    setRows([]);
    setMeta({});
    try {
      const result = await previewStatement(wallet.id, wallet.bank_type as any, files);
      setRows(result.rows);
      setMeta(result.meta);
      setDetectedBank(wallet.bank_type);
      setWalletName(wallet.name);
      setWalletIcon(wallet.icon ?? '');
      setParseState('done');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to parse statement.');
      setParseState('error');
    }
  };

  const handleFilesPick = (picked: FileList | File[]) => {
    const arr = Array.from(picked);
    const existing = new Set(files.map(f => f.name + f.size));
    const merged = [...files, ...arr.filter(f => !existing.has(f.name + f.size))];
    setFiles(merged);
    setConfirmState('idle');
    handleParse(merged);
  };

  const handleAddMore = (picked: FileList | File[]) => {
    const arr = Array.from(picked);
    const existing = new Set(files.map(f => f.name + f.size));
    const merged = [...files, ...arr.filter(f => !existing.has(f.name + f.size))];
    setFiles(merged);
    setConfirmState('idle');
    handleParse(merged);
  };

  const handleConfirm = async () => {
    setConfirmState('confirming');
    setError('');
    try {
      const result = await confirmImport(userId, rows, meta);
      setInsertedCount(result.inserted);
      onDone();
      setConfirmState('done');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save transactions.');
      setConfirmState('idle');
    }
  };

  const handleReset = () => {
    setParseState('idle');
    setConfirmState('idle');
    setFiles([]);
    setRows([]);
    setMeta({});
    setDetectedBank('');
    setWalletName('');
    setWalletIcon('');
    setError('');
    setInsertedCount(0);
  };

  const transfers = rows.filter(r => r.isTransfer);
  const nonTransfer = rows.filter(r => !r.isTransfer);
  const income = nonTransfer.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = nonTransfer.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const isParsing = parseState === 'parsing';
  const isParseDone = parseState === 'done';
  const isParseError = parseState === 'error';
  const showFallback = isParseError && files.length > 0 && fallbackWallets.length > 0;
  const canImport = isParseDone && confirmState === 'idle' && rows.length > 0;
  const isConfirming = confirmState === 'confirming';

  const importBtnLabel = isConfirming
    ? 'Importing…'
    : parseState === 'parsing'
      ? 'Parsing…'
      : parseState === 'done' && rows.length > 0
        ? `Import ${rows.length} transactions`
        : parseState === 'done' && rows.length === 0
          ? 'No transactions found'
          : 'Import';

  const renderDropZone = () => {
    if (parseState === 'idle' as ParseState) {
      return (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files.length) handleFilesPick(e.dataTransfer.files);
          }}
          style={{
            border: `2px dashed ${isDragOver ? 'var(--laccent)' : 'var(--card-border)'}`,
            borderRadius: 16, padding: '40px 24px',
            textAlign: 'center', cursor: 'pointer',
            background: isDragOver ? 'rgba(112,162,136,0.08)' : 'var(--surface-subtle)',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)', marginBottom: 6 }}>
            Drop your bank statement here
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
            PDF or screenshot · BCA, Permata, Jago, Stockbit, GoPay, ShopeePay, OVO · multiple files ok
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) handleFilesPick(e.target.files); e.target.value = ''; }}
          />
        </div>
      );
    }

    if (parseState === 'parsing') {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', borderRadius: 14,
          background: 'var(--surface-subtle)', border: '1px solid var(--card-border)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            border: '2.5px solid var(--card-border)',
            borderTopColor: 'var(--laccent)',
            animation: 'spin 0.9s linear infinite',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 3 }}>
              Parsing {files.length} file{files.length !== 1 ? 's' : ''}…
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>detecting bank · extracting transactions</div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--laccent)',
                display: 'inline-block',
                animation: `pulse-dot 1.3s ease-in-out ${i * 0.22}s infinite`,
              }} />
            ))}
          </div>
        </div>
      );
    }

    // done or error — compact add-more pill
    return (
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files.length) handleAddMore(e.dataTransfer.files);
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
          border: `1.5px dashed ${isDragOver ? 'var(--laccent)' : 'var(--card-border)'}`,
          background: isDragOver ? 'rgba(112,162,136,0.06)' : 'transparent',
          transition: 'all 0.15s', width: 'fit-content',
          fontSize: 12, color: 'var(--fg-muted)',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>＋</span>
        Add more files
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) handleAddMore(e.target.files); e.target.value = ''; }}
        />
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="glass p-0 gap-0 overflow-hidden sm:max-w-[620px] max-h-[88vh] flex flex-col">
        {/* Header */}
        <DialogHeader style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--card-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="eyebrow">Upload Statement</div>
              <DialogTitle style={{
                fontSize: 15, fontWeight: 500, color: 'var(--fg)', marginTop: 3,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {walletName && parseState !== 'idle' && parseState !== 'parsing' ? (
                  <>
                    {walletIcon && <span>{walletIcon}</span>}
                    {walletName}
                    {detectedBank && (
                      <Badge variant="outline" style={{ fontSize: 11 }}>
                        {BANK_LABELS[detectedBank] ?? detectedBank.toUpperCase()}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span style={{ color: parseState === 'parsing' ? 'var(--fg-muted)' : 'var(--fg)', fontWeight: 400 }}>
                    {parseState === 'idle'
                      ? "Drop a statement — we'll detect the account"
                      : parseState === 'parsing'
                        ? 'Detecting account…'
                        : parseState === 'error'
                          ? 'Could not detect account'
                          : ''}
                  </span>
                )}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Drop zone */}
          {renderDropZone()}

          {/* Success banner */}
          {confirmState === 'done' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(112,162,136,0.12)', border: '1px solid rgba(112,162,136,0.35)',
            }}>
              <span style={{ fontSize: 22 }}>✓</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pos)' }}>
                  {insertedCount} transaction{insertedCount !== 1 ? 's' : ''} imported
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                  Added to {walletName}
                </div>
              </div>
            </div>
          )}

          {/* Summary bar */}
          {isParseDone && rows.length > 0 && (
            <div style={{
              display: 'flex', gap: 12, flexWrap: 'wrap',
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            }}>
              <div style={{ flex: 1, minWidth: 80 }}>
                <div className="eyebrow" style={{ marginBottom: 2 }}>Transactions</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>{rows.length}</div>
              </div>
              {income > 0 && (
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Income</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--pos)' }}>{fmt(income)}</div>
                </div>
              )}
              {expense > 0 && (
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Expense</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--neg)' }}>{fmt(expense)}</div>
                </div>
              )}
              {transfers.length > 0 && (
                <div style={{ flex: 1, minWidth: 80 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Transfers</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-muted)' }}>{transfers.length}</div>
                </div>
              )}
              {meta.closingBalance !== undefined && (
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Statement balance</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--laccent)' }}>{fmt(meta.closingBalance)}</div>
                </div>
              )}
              {meta.coveredThrough && (
                <div style={{ flex: 1, minWidth: 145 }}>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>Statement coverage</div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                    {meta.coveredFrom && meta.coveredFrom !== meta.coveredThrough ? `${meta.coveredFrom} – ` : ''}{meta.coveredThrough}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>
                    {meta.coverageConfidence ?? 'medium'} confidence
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction table */}
          {isParseDone && rows.length > 0 && (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 110px 70px',
                background: 'rgba(3,29,68,0.03)',
                padding: '8px 14px', borderBottom: '1px solid var(--card-border)',
              }}>
                {['Date', 'Description', 'Amount', 'Type'].map(h => (
                  <div key={h} className="eyebrow" style={{ fontSize: 10 }}>{h}</div>
                ))}
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {rows.map((row, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 110px 70px',
                    padding: '8px 14px',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--card-border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'var(--surface-subtle)',
                    alignItems: 'center',
                  }}>
                    <div className="num" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{row.date}</div>
                    <div style={{
                      fontSize: 12, color: 'var(--fg)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8,
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
          )}

          {/* Error message */}
          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(213,137,111,0.10)', border: '1px solid rgba(213,137,111,0.30)',
              fontSize: 13, color: 'var(--neg)',
            }}>
              {error}
            </div>
          )}

          {/* Fallback wallet picker after detection failure */}
          {showFallback && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Choose account manually</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fallbackWallets.map(w => (
                  <button
                    key={w.id}
                    onClick={() => handleFallbackParse(w)}
                    disabled={isParsing}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                      border: '1px solid var(--card-border)',
                      background: 'var(--card-bg)',
                      textAlign: 'left', width: '100%',
                      transition: 'all 0.15s',
                      opacity: isParsing ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{w.icon || '🏦'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>
                        {BANK_LABELS[w.bank_type!] ?? w.bank_type}
                        {w.account_number && ` · ${w.account_number}`}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Parse →</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--card-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
          alignItems: 'center',
        }}>
          {confirmState === 'done' ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                Import more
              </Button>
              <Button onClick={() => { onDone(); onClose(); }}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canImport || isConfirming}
                style={{
                  background: canImport ? 'var(--laccent)' : undefined,
                  boxShadow: canImport ? '0 0 0 1px rgba(255,255,255,0.18) inset, 0 6px 18px -4px var(--accent-glow)' : undefined,
                }}
              >
                {isConfirming && (
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                {importBtnLabel}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
