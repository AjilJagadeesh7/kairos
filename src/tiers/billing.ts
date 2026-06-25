import { openExternal } from '../utils/openExternal'

// Subscription management lives on the Kairos website (Stripe customer portal),
// not in-app. These are the entry points; the portal handles auth + plan changes.
export const BILLING_MANAGE_URL = 'https://kairos.app/account/billing'
export const BILLING_CANCEL_URL = 'https://kairos.app/account/billing/cancel'

export function openManageSubscription(): Promise<void> {
  return openExternal(BILLING_MANAGE_URL)
}

export function openCancelSubscription(): Promise<void> {
  return openExternal(BILLING_CANCEL_URL)
}
