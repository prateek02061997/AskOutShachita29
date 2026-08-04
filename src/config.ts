// Configuration for Form Email Notifications
const env = import.meta as ImportMeta & { env?: { VITE_NOTIFICATION_GMAIL?: string } };

export const TARGET_GMAIL = env.env?.VITE_NOTIFICATION_GMAIL || 'pprateek26@gmail.com';

