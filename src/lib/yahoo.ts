/** Yahoo Finance symbol suffix per S&P Capital IQ exchange code ('' = none). */
const SUFFIX: Record<string, string> = {
	NYSE: '', NYSEAM: '', NasdaqGS: '', NasdaqGM: '', NasdaqCM: '', OTCPK: '',
	TSE: '.T', BSE: '.BO', NSEI: '.NS', SZSE: '.SZ', SHSE: '.SS', SEHK: '.HK',
	KOSDAQ: '.KQ', KOSE: '.KS', ASX: '.AX', TSXV: '.V', TSX: '.TO', CNSX: '.CN',
	TPEX: '.TWO', TWSE: '.TW', KLSE: '.KL', SET: '.BK', IDX: '.JK', OM: '.ST',
	NGM: '.ST', WSE: '.WA', ENXTPA: '.PA', ENXTAM: '.AS', ENXTBR: '.BR',
	ENXTLS: '.LS', IBSE: '.IS', AIM: '.L', LSE: '.L', TASE: '.TA', BIT: '.MI',
	XTRA: '.DE', DB: '.F', SGX: '.SI', Catalist: '.SI', OB: '.OL', BOVESPA: '.SA',
	SWX: '.SW', JSE: '.JO', BME: '.MC', HLSE: '.HE', CPSE: '.CO', ATSE: '.AT',
	NZSE: '.NZ', BMV: '.MX', WBAG: '.VI', SASE: '.SR', MUN: '.MU', PSE: '.PS'
};

const SYMBOL = /^[A-Za-z0-9.&-]+$/;

/** Yahoo Finance page for a Capital IQ style ticker such as `ENXTAM:ABN`; null when there is none. */
export function yahooUrl(ticker: string, name = ''): string | null {
	const [exchange, symbol] = ticker.split(':', 2);
	if (!symbol) return null;
	// Yahoo's .BO symbols are names (RELIANCE.BO), not the numeric BSE scrip codes used here
	const company = name.replace(/\s*\([^()]*\)$/, '');
	if (exchange === 'BSE' && /^\d+$/.test(symbol) && company) {
		return `https://finance.yahoo.com/lookup?s=${encodeURIComponent(company)}`;
	}
	const suffix = SUFFIX[exchange];
	if (suffix === undefined || !SYMBOL.test(symbol)) {
		return `https://finance.yahoo.com/lookup?s=${encodeURIComponent(symbol)}`;
	}
	let s = symbol;
	if (exchange === 'SEHK' && /^\d+$/.test(s)) s = s.padStart(4, '0');
	if (suffix === '') s = s.replace('.', '-');
	return `https://finance.yahoo.com/quote/${encodeURIComponent(s + suffix)}`;
}
