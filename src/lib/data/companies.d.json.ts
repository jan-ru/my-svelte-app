// Types for companies.json, which `npm run build:companies` generates. TypeScript uses this file instead of
// inferring a type from the JSON, so importers need no cast; data.test.ts checks that the file has this shape.
import type { CompanyData } from '../companies';

declare const data: CompanyData;
export default data;
