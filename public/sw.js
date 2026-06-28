self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "T-Kit", {
      body:  data.body  ?? "",
      icon:  data.icon  ?? "/icon-192.png",
      badge: data.badge ?? "/icon-192.png",
      data:  data.url   ? { url: data.url } : {},
      tag:   data.tag   ?? "tkit",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client)
          return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
