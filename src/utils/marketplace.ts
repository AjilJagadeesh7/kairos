/**
 * Plugin marketplace availability.
 *
 * The marketplace is an optional, build-time integration: `VITE_MARKETPLACE_URL`
 * points at the site embedded in the Marketplace settings section. Builds that
 * ship without it hide the section entirely rather than offering a dead tab.
 */
const RAW = import.meta.env.VITE_MARKETPLACE_URL as string | undefined

/** The configured marketplace origin, or undefined when this build has none. */
export const MARKETPLACE_URL: string | undefined = RAW?.trim() || undefined

/** True when this build ships with a marketplace to browse. */
export function isMarketplaceEnabled(): boolean {
  return MARKETPLACE_URL !== undefined
}
