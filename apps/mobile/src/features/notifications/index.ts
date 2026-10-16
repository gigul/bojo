// Public API of the notifications feature (ARCHITECTURE §2.4).
export { NotificationsBridge } from './NotificationsBridge';
export { NotificationsBell } from './NotificationsBell';
export {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotificationsCount,
  type InboxItem,
} from './api';
export { notificationContent, notificationUrl } from './format';
