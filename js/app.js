const App = {
  init(role) {
    const user = Auth.requireRole(role);
    if (!user) return;
    this.renderSidebar(user, role);
    this.renderTopbar(user);
  },

  renderSidebar(user, role) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const links = {
      USER: [
        { href: "dashboard.html", text: "Dashboard", icon: "space_dashboard" },
        { href: "issues.html", text: "My Issues", icon: "assignment" },
        { href: "report.html", text: "Report Issue", icon: "add_circle" },
        { href: "profile.html", text: "Profile", icon: "person" },
      ],
      WORKER: [
        { href: "dashboard.html", text: "Dashboard", icon: "space_dashboard" },
        { href: "issues.html", text: "Assigned Issues", icon: "build" },
        { href: "profile.html", text: "Profile", icon: "person" },
      ],
      ADMIN: [
        { href: "dashboard.html", text: "Dashboard", icon: "space_dashboard" },
        { href: "issues.html", text: "Issues", icon: "assignment" },
        { href: "workers.html", text: "Workers", icon: "engineering" },
        { href: "categories.html", text: "Categories", icon: "category" },
        { href: "announcements.html", text: "Announcements", icon: "campaign" },
        { href: "analytics.html", text: "Analytics", icon: "monitoring" },
        { href: "sla.html", text: "SLA Settings", icon: "schedule" },
        { href: "users.html", text: "Users", icon: "group" },
      ],
    };
    const path = window.location.pathname.split("/").pop();
    sidebar.innerHTML = `
            <div class="sidebar-header">CampusFix</div>
            <ul class="sidebar-nav">
                ${links[role].map((l) => `<li><a href="${l.href}" class="${path === l.href ? "active" : ""}"><span class="material-symbols-outlined" aria-hidden="true">${l.icon}</span> ${l.text}</a></li>`).join("")}
                <li><a href="#" id="logout-btn"><span class="material-symbols-outlined" aria-hidden="true">logout</span> Logout</a></li>
            </ul>
        `;
    document.getElementById("logout-btn").onclick = (e) => {
      e.preventDefault();
      Auth.logout();
    };
  },

  renderTopbar(user) {
    const topbar = document.getElementById("topbar");
    if (!topbar) return;
    topbar.innerHTML = `
            <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open navigation"><span class="material-symbols-outlined" aria-hidden="true">menu</span></button>
            <h1 class="topbar-title">${document.title.split(" - ")[0] || "Dashboard"}</h1>
            <div class="topbar-actions">
                <a class="notification-bell" id="notif-bell" aria-label="Notifications" href="../${user.role.toLowerCase()}/notifications.html"><span class="material-symbols-outlined" aria-hidden="true">notifications</span> <span class="notification-badge" id="notif-count" style="display:none">0</span></a>
                <div class="user-menu"><span>${user.name}</span></div>
            </div>
        `;
    document.getElementById("mobile-menu-btn").onclick = () =>
      document.getElementById("sidebar").classList.toggle("open");
  },
};
