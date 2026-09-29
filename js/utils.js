const Utils = {
  generateId: () => Math.random().toString(36).substr(2, 9),
  generateRef: () => {
    const issues = Storage.getIssues();
    const num = (issues.length + 1).toString().padStart(5, "0");
    return `CF-2026-${num}`;
  },
  formatDate: (ts) => new Date(ts).toLocaleString(),
  formatShortDate: (ts) => new Date(ts).toLocaleDateString(),

  toast: (msg, type = "info") => {
    const container =
      document.getElementById("toast-container") ||
      (() => {
        const c = document.createElement("div");
        c.id = "toast-container";
        c.className = "toast-container";
        document.body.appendChild(c);
        return c;
      })();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  },

  getSLAStatus: (issue) => {
    if (["CLOSED", "REJECTED"].includes(issue.status)) return "ON TIME";
    const now = Date.now();
    const sla = Storage.getSLASettings();
    const hours = sla[issue.priority] || 48;
    const deadline = issue.createdAt + hours * 3600000;
    if (now > deadline) return "OVERDUE";
    if (deadline - now < hours * 3600000 * 0.2) return "DUE SOON";
    return "ON TIME";
  },

  suggestPriority: (category, description) => {
    const desc = description.toLowerCase();
    if (
      desc.includes("fire") ||
      desc.includes("spark") ||
      desc.includes("flood") ||
      desc.includes("safety")
    )
      return "CRITICAL";
    if (
      desc.includes("broken") ||
      desc.includes("leak") ||
      desc.includes("no power")
    )
      return "HIGH";
    if (category === "Electrical" || category === "Plumbing") return "MEDIUM";
    return "LOW";
  },

  checkDuplicate: (newIssue) => {
    const issues = Storage.getIssues().filter(
      (i) => i.status !== "CLOSED" && i.status !== "REJECTED",
    );
    return issues.find(
      (i) =>
        i.category === newIssue.category &&
        i.building === newIssue.building &&
        i.room === newIssue.room &&
        Date.now() - i.createdAt < 86400000, // last 24h
    );
  },
};
