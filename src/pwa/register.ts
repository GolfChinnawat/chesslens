let registration: Promise<ServiceWorkerRegistration> | undefined

export function registerOffline() {
  const worker = new URL(import.meta.env.BASE_URL + 'sw.js', document.baseURI)
  return (registration ??= navigator.serviceWorker.register(worker, {
    updateViaCache: 'none',
  }))
}
