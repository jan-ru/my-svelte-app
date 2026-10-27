import { isrConfig } from '#lib/server/access';

// The page itself is static; the config lets it share the cache and the login bypass with the other pages.
export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);
