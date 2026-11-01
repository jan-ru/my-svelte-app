/** Yahoo Finance symbol suffix per S&P Capital IQ exchange code ('' = none). */
const SUFFIX: Record<string, string> = {
	NYSE: '',
	NYSEAM: '',
	NasdaqGS: '',
	NasdaqGM: '',
	NasdaqCM: '',
	OTCPK: '',
	TSE: '.T',
	NSEI: '.NS',
	SZSE: '.SZ',
	SHSE: '.SS',
	SEHK: '.HK',
	KOSDAQ: '.KQ',
	KOSE: '.KS',
	ASX: '.AX',
	TSXV: '.V',
	TSX: '.TO',
	CNSX: '.CN',
	TPEX: '.TWO',
	TWSE: '.TW',
	SET: '.BK',
	IDX: '.JK',
	OM: '.ST',
	NGM: '.ST',
	WSE: '.WA',
	ENXTPA: '.PA',
	ENXTAM: '.AS',
	ENXTBR: '.BR',
	ENXTLS: '.LS',
	IBSE: '.IS',
	AIM: '.L',
	LSE: '.L',
	TASE: '.TA',
	BIT: '.MI',
	XTRA: '.DE',
	DB: '.F',
	SGX: '.SI',
	Catalist: '.SI',
	OB: '.OL',
	BOVESPA: '.SA',
	SWX: '.SW',
	JSE: '.JO',
	BME: '.MC',
	HLSE: '.HE',
	CPSE: '.CO',
	ATSE: '.AT',
	NZSE: '.NZ',
	BMV: '.MX',
	WBAG: '.VI',
	SASE: '.SR',
	MUN: '.MU'
};

const SYMBOL = /^[A-Za-z0-9.&-]+$/;

/** Yahoo Finance symbol for a Capital IQ style ticker such as `ENXTAM:ABN` (`ABN.AS`); null when Yahoo has no such listing. */
export function yahooSymbol(ticker: string): string | null {
	const [exchange = '', symbol] = ticker.split(':', 2);
	if (!symbol) return null;
	const suffix = SUFFIX[exchange];
	let s = symbol;
	// Korean codes carry a leading A (A005930); Mexican ones a share class (AMX B, ALSEA *)
	if (exchange === 'KOSDAQ' || exchange === 'KOSE') s = s.replace(/^A(?=\d{6}$)/, '');
	if (exchange === 'BMV') s = s.replace(/[ *]/g, '');
	if (suffix === undefined || !SYMBOL.test(s)) return null;
	if (exchange === 'SEHK' && /^\d+$/.test(s)) s = s.padStart(4, '0');
	if (suffix === '') s = s.replace('.', '-');
	return s + suffix;
}

/** Yahoo Finance quote page for a Capital IQ style ticker such as `ENXTAM:ABN`; null when Yahoo has no such listing. */
export function yahooQuote(ticker: string): string | null {
	const symbol = yahooSymbol(ticker);
	return symbol ? `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}` : null;
}

/** Yahoo Finance search for a ticker that has no quote page; null without a ticker. */
export function yahooSearch(ticker: string, name = ''): string | null {
	const symbol = ticker.split(':', 2)[1];
	if (!symbol) return null;
	// numeric BSE scrip codes mean nothing to Yahoo, so search by company name
	const company = name.replace(/\s*\([^()]*\)$/, '');
	const term = ticker.startsWith('BSE:') && /^\d+$/.test(symbol) && company ? company : symbol;
	return `https://finance.yahoo.com/lookup?s=${encodeURIComponent(term)}`;
}
