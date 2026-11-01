// Types for macro.json, which `npm run build:gdp` generates. TypeScript uses this file instead of
// inferring a type from the JSON, so importers need no cast; macro.test.ts checks that the file has this shape.
import type { MacroData } from '../macro';

declare const data: MacroData;
export default data;
