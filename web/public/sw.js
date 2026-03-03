// PAI-X Service Worker — Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "PAI-X",
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || "Neue Routine-Benachrichtigung",
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/badge-72x72.png",
    tag: data.notification_id || "pai-notification",
    renotify: true,
    data: {
      url: data.url || "/routines",
      notification_id: data.notification_id,
      run_id: data.run_id,
    },
    actions: [
      { action: "open", title: "Offnen" },
      { action: "dismiss", title: "Verwerfen" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "PAI-X", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/routines";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        return self.clients.openWindow(url);
      })
  );
});
