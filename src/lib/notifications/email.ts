import 'server-only'

export {
  buildNotificationEmailHtml,
  escapeHtml,
  resolveNotificationHref,
  sendNotificationEmail,
  NotificationEmailConfigurationError,
  type NotificationEmailRecord,
} from './email-core'
