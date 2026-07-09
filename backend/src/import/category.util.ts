// Keyword-based auto-categorization for Indonesian bank transactions.
// Rules are checked in order — first match wins.

interface Rule {
  pattern: RegExp;
  category: string;
}

const INCOME_RULES: Rule[] = [
  { pattern: /\bgaji\b|salary|payroll|thr\b|rapel/i, category: 'Salary' },
  { pattern: /dividen|dividend/i, category: 'Dividend' },
  { pattern: /bibit|stockbit|investment\s*return/i, category: 'Investment Return' },
  { pattern: /bunga|interest\s*dep|jasa\s*giro/i, category: 'Investment Return' },
  { pattern: /freelance|konsultan|honor|fee\s*project/i, category: 'Freelance' },
  { pattern: /hadiah|gift|cashback|refund|pengembalian/i, category: 'Gift' },
];

const EXPENSE_RULES: Rule[] = [
  // Food & Dining
  {
    pattern: /shopeefood|shopee\s*food|gofood|grab\s*food|gomart|alfamart|indomaret|mcdonald|kfc\b|burger|pizza|restoran|resto\b|cafe\b|\bkopi\b|coffee|warteg|bakso|soto|ayam\s+goreng|nasi\b|padang|starbucks|chatime|mixue|geprek|j\.co|breadtalk|richeese|hokben|kebab|sushi|ramen|boba|milk\s*tea|fried\s*chicken|es\s*teh|cimory|mbok\s*berek|bluebird.*kantin|kantin.*bluebird|pecel\s*lele|bebek|jonkira|kimukatsu|yoshinoya|mm\s*juice|roti\s*[o']|roti\s*sordo|sancha\b|solaria|city\s*boys|kopi\s*nako|dapoer|madam\s*kaya|mako\s*bekasi|mozdeo|cotr\s*calf|kopi\s*dibawah|jejepangan|shushu\s*koe|tarobun|teman\s*coffee|martabak|keripik|nasgor|nasi\s*goreng|puyo\b|warung|bisku\b|bakmi|mie\s*gacoan|geprek|geprek|somay|siomay|cakwe|kue\s*|es\s*krim|ice\s*cream|minuman|snack|jajan|dapur/i,
    category: 'Food & Dining',
  },
  // Transportation
  {
    pattern: /\bbluebird\b(?!.*kantin)|access\s*by\s*kai|\bkai\s*commuter|tiket\.com|tiketcom|\bgrab\b(?!\s*food)|\bgojek\b|goride|pertamina|shell\b|parkir|toll\b|tol\b|transjakarta|busway|\bkrl\b|\bmrt\b|\blrt\b(?!.*kantin)|kereta|damri|maxim|indriver|bensin|bbm|spbu|gocar|grabbike|grabcar|ojek/i,
    category: 'Transportation',
  },
  // Shopping
  {
    pattern: /shopee(?!\s*food|\s*pay)|tokopedia|lazada|blibli|tiktok\s*shop|zalora|h&m\b|zara\b|uniqlo|miniso|ikea|ace\s*hardware|hypermart|carrefour|transmart|lotte\s*mart|lottemart|hero\s*supermarket|ranch\s*market|super\s*indo|superindo|matahari|sociolla|hazeera|watsons?|being\b|toko\s*kesayangan|sogo\b|spaylater|spayl\s*ater|shopee\s*vip|shopee\s*marketplace|all\s*fresh/i,
    category: 'Shopping',
  },
  // Bills & Utilities
  {
    pattern: /\bpln\b|token\s*listrik|listrik|telkomsel|indosat|\bioh\b|xl\s*axiata|\baxis\b|telkom|indihome|\bwifi\b|internet\s*\d|bpjs|iuran\s*bpjs|pdam|air\s*bersih|\bpgn\b|gas\s*alam|cicilan|angsuran|tagihan|paket\s*data|lusiana.*produk\s*digital|produk\s*digital.*lusiana|biaya\s*adm|admin.*bulan|pajak\s*bunga|e-wallet.*fee|ewallet.*fee|top\s*up\s*fee|biaya\s*transfer|transfer.*biaya|ovo.*biaya|\bkost\b|sewa\s*kos|kos\s*bulanan|livia\s*kost|\bsubscription\b|bea\s*meterai/i,
    category: 'Bills & Utilities',
  },
  // Entertainment & Subscriptions
  {
    pattern: /netflix|spotify|youtube\s*premium|disney|vidio\.com|bioskop|cgv|cinepolis|imax|\bxxl\b|steam\b|playstation|xbox|nintendo|games?\s*top\s*up|mobile\s*legend|free\s*fire|genshin|anthropic|claude\.ai|google\s*one|oracle\b|tix\s*id|tixid/i,
    category: 'Entertainment',
  },
  // Health
  {
    pattern: /apotek|apotik|klinik|rumah\s*sakit|\brs\b\s+[a-z]|dokter|vitamin|suplemen|guardian|century\s*health|kimia\s*farma|halodoc|alodokter|good\s*doctor|farmasi/i,
    category: 'Health',
  },
  // Education
  {
    pattern: /sekolah|kampus|universitas|spp\b|ukt\b|kursus|\bles\b|udemy|coursera|dicoding|ruangguru|zenius|quipper|skill\s*academy|buku\s*teks/i,
    category: 'Education',
  },
  // Family Support
  {
    pattern: /intan\s*wahyu/i,
    category: 'Family Support',
  },
  // Charity
  {
    pattern: /sedekah|donasi|infaq|zakat|amal\b|charity/i,
    category: 'Charity',
  },
  // Investment
  {
    pattern: /pembelian\s*reksa|beli\s*saham|stockbit|bibit\s*beli|reksa\s*dana/i,
    category: 'Investment',
  },
];

export function autoCategory(description: string, type: 'income' | 'expense', isTransfer: boolean): string {
  if (isTransfer) {
    // Investment app transactions: buying, selling, depositing, or withdrawing from investment platforms.
    // These are transfers (excluded from income/expense totals) but labelled 'Investment' for clarity.
    if (/pembelian|pencairan|order\s*jual|\bbibit\b|\bstockbit\b/i.test(description)) {
      return 'Investment';
    }
    return 'Internal Transfer';
  }

  const rules = type === 'income' ? INCOME_RULES : EXPENSE_RULES;
  for (const rule of rules) {
    if (rule.pattern.test(description)) return rule.category;
  }

  return type === 'income' ? 'Other Income' : 'Other Expense';
}
