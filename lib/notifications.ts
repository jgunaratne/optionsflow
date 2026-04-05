// Browser push notification helpers
// For now, we log to console only (email/SMS notifications are out of scope)

export function notifyTokenExpiry(hoursUntilExpiry: number): void {
  console.warn(`[ALERT] Broker refresh token expires in ${hoursUntilExpiry.toFixed(1)} hours. Re-authorize via auth-setup.`);
}

export function notifyScreenerComplete(candidateCount: number): void {
  console.log(`[Screener] Complete: ${candidateCount} candidates found.`);
}

export function notifyExecutionResult(filled: number, failed: number, totalPremium: number): void {
  if (failed > 0) {
    console.warn(`[Execution] ${filled} orders filled, ${failed} failed. Total premium: $${totalPremium.toFixed(2)}`);
  } else {
    console.log(`[Execution] All ${filled} orders filled. Total premium: $${totalPremium.toFixed(2)}`);
  }
}

export function notifyRiskBreach(message: string): void {
  console.error(`[RISK BREACH] ${message}`);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico', tag: 'optionsflow' });
}
