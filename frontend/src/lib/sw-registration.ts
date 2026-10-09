import { devicesApi } from '@/api/devices'
import { useDeviceStore } from '@/stores/deviceStore'

// How push notifications get turned on:
//   1. register the service worker (public/sw.js), which shows notifications even when the tab is closed
//   2. ask the browser for permission
//   3. subscribe to push with our VAPID public key
//   4. send that subscription to the server (POST /devices), so the server knows where to push

// The service worker runs outside the app, so it can't read VITE_API_URL itself.
// We pass the server address in the URL, and sw.js reads it from there.
function swUrl(): string {
  const api = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin
  return `/sw.js?api=${encodeURIComponent(api)}`
}

const isPushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window

// The VAPID public key from .env, or null while it still has the placeholder value.
function getVapidKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
  return key && key !== 'your_vapid_public_key_here' ? key : null
}

// Registers sw.js (or picks up the newest version of it) and waits until it is running.
async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(swUrl())
  await registration.update()
  await navigator.serviceWorker.ready
  return registration
}

// The browser gives the key as base64 text, but subscribe() needs raw bytes.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

/**
 * Full flow, including the browser's permission popup.
 * Called when the user clicks "Enable" / "Enable Push", and right after login.
 */
export async function registerPushSubscription(): Promise<void> {
  if (!isPushSupported()) {
    console.warn('[SW] Push notifications not supported in this browser')
    return
  }

  const vapidKey = getVapidKey()
  if (!vapidKey) {
    console.warn('[SW] VITE_VAPID_PUBLIC_KEY not configured')
    return
  }

  const registration = await registerWorker()

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('[SW] Notification permission denied')
    return
  }

  await subscribeAndRegister(registration, vapidKey)
}

/**
 * Silent version, run on every page load while logged in.
 * It never shows the permission popup: if permission was given before, it makes sure this
 * device is still registered with the server. Otherwise the NotificationPermission banner asks.
 */
export async function initServiceWorker(): Promise<void> {
  if (!isPushSupported()) return

  const vapidKey = getVapidKey()
  if (!vapidKey) return

  try {
    const registration = await registerWorker()
    if (Notification.permission !== 'granted') return
    await subscribeAndRegister(registration, vapidKey)
  } catch (err) {
    // Not fatal: the rest of the app works without notifications.
    console.warn('[SW] initServiceWorker failed silently:', err)
  }
}

// Reuses the browser's push subscription (or creates one) and saves it on the server.
async function subscribeAndRegister(
  registration: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<void> {
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    })
    console.info('[SW] New push subscription created')
  } else {
    console.info('[SW] Existing push subscription found')
  }

  // Remember the device id, so Layout can ping the server every 5 minutes.
  const device = await devicesApi.register(JSON.stringify(subscription), true)
  useDeviceStore.getState().setDeviceId(device.id)
  console.info('[SW] Device registered with backend — id:', device.id)
}

// Used on logout: stop the service worker so this browser gets no more notifications.
export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
  useDeviceStore.getState().clearDevice()
}
