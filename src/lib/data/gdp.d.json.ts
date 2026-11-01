// Types for gdp.json, which `npm run build:gdp` generates. TypeScript uses this file instead of
// inferring a type from the JSON, so importers need no cast; gdp.test.ts checks that the file has this shape.
import type { GdpData } from '../gdp';

declare const data: GdpData;
export default data;
