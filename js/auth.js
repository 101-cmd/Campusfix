const Auth = {
  getBasePath() {
    const path = window.location.pathname;
    const pageFolder = path.slice(0, path.lastIndexOf("/") + 1);
    const roleFolder = /\/(admin|user|worker)\/$/.test(pageFolder);
    const baseFolder = roleFolder
      ? pageFolder.replace(/(admin|user|worker)\/$/, "")
      : pageFolder;
    return baseFolder;
  },
  getPagePath(page) {
    return `${this.getBasePath()}${page}`;
  },
  login(email, password) {
    const users = Storage.getUsers();
    const user = users.find(
      (u) => u.email === email && u.password === password,
    );
    if (!user) throw new Error("Invalid email or password");
    if (user.status !== "ACTIVE") throw new Error("Account is deactivated");

    sessionStorage.setItem("cf_currentUser", JSON.stringify(user));
    return user;
  },
  register(data) {
    const users = Storage.getUsers();
    if (users.find((u) => u.email === data.email))
      throw new Error("Email already registered");

    const newUser = {
      id: Utils.generateId(),
      ...data,
      role: "USER",
      status: "ACTIVE",
    };
    users.push(newUser);
    Storage.saveUsers(users);
    return newUser;
  },
  logout() {
    sessionStorage.removeItem("cf_currentUser");
    window.location.href = this.getPagePath("html/login.html");
  },
  getCurrentUser() {
    const u = sessionStorage.getItem("cf_currentUser");
    return u ? JSON.parse(u) : null;
  },
  requireRole(role) {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = this.getPagePath("html/login.html");
      return null;
    }
    if (user.role !== role) {
      const redirect =
        user.role === "ADMIN"
          ? this.getPagePath("admin/dashboard.html")
          : user.role === "WORKER"
            ? this.getPagePath("worker/dashboard.html")
            : this.getPagePath("user/dashboard.html");
      window.location.href = redirect;
      return null;
    }
    return user;
  },
};
