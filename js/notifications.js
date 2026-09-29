const Notifications = {
  getAll(userId) {
    const all = Storage.getNotifications();
    return userId ? all.filter((n) => n.userId === userId) : all;
  },

  getUnreadCount(userId) {
    return this.getAll(userId).filter((n) => !n.read).length;
  },

  create(userId, message) {
    if (userId === "ADMIN") {
      Storage.getUsers()
        .filter((u) => u.role === "ADMIN")
        .forEach((a) => {
          this.create(a.id, message);
        });
      return;
    }
    const notifs = Storage.getNotifications();
    notifs.unshift({
      id: Utils.generateId(),
      userId,
      message,
      read: false,
      createdAt: Date.now(),
    });
    Storage.saveNotifications(notifs);
  },

  markRead(notifId) {
    const notifs = Storage.getNotifications();
    const n = notifs.find((x) => x.id === notifId);
    if (n) n.read = true;
    Storage.saveNotifications(notifs);
  },

  markAllRead(userId) {
    const notifs = Storage.getNotifications();
    notifs.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
    Storage.saveNotifications(notifs);
  },

  renderBell(userId) {
    const count = this.getUnreadCount(userId);
    const badge = document.getElementById("notif-count");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
  },

  renderList(userId, containerId) {
    const notifs = this.getAll(userId).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    const container = document.getElementById(containerId);
    if (!notifs.length) {
      container.innerHTML =
        '<div class="empty-state"><h3>No notifications</h3><p>You\'re all caught up.</p></div>';
      return;
    }
    container.innerHTML = notifs
      .map(
        (n) => `
            <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}" style="padding:1rem;border-bottom:1px solid var(--border);cursor:pointer;${n.read ? "" : "background:#eff6ff;"}">
                <p style="font-weight:${n.read ? "400" : "600"}">${n.message}</p>
                <small style="color:var(--text-secondary)">${Utils.formatDate(n.createdAt)}</small>
            </div>
        `,
      )
      .join("");

    container.querySelectorAll(".notif-item").forEach((el) => {
      el.onclick = () => {
        this.markRead(el.dataset.id);
        el.style.background = "";
        el.querySelector("p").style.fontWeight = "400";
        this.renderBell(userId);
      };
    });
  },
};
