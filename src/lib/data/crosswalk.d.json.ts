// Types for crosswalk.json, which `npm run build:crosswalk` generates. TypeScript uses this file instead of
// inferring a type from the JSON, so importers need no cast; data.test.ts checks that the file has this shape.
import type { Crosswalk } from '../crosswalk';

declare const data: Crosswalk;
export default data;
