export type NotificationPreferences = {
  order_updates: boolean
  payment_updates: boolean
  shipping_updates: boolean
  security_updates: boolean
  marketing_updates: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  order_updates: true,
  payment_updates: true,
  shipping_updates: true,
  security_updates: true,
  marketing_updates: true,
}

export function isNotificationEmailEnabled(
  type: string,
  preferences?: Partial<NotificationPreferences> | null,
) {
  const merged = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferences || {}),
  }

  if (type.startsWith('shipment.')) return merged.shipping_updates
  if (type.startsWith('order.payment')) return merged.payment_updates
  if (type.startsWith('order.') || type.startsWith('offer.')) return merged.order_updates
  if (type.startsWith('moderation.')) return merged.security_updates

  return true
}
