const Analytics = {
  getStats() {
    const issues = Storage.getIssues();
    const now = Date.now();
    const sla = Storage.getSLASettings();
    const open = issues.filter(
      (i) => !["CLOSED", "REJECTED"].includes(i.status),
    );
    const overdue = open.filter((i) => {
      const hours = sla[i.priority] || 48;
      return now > i.createdAt + hours * 3600000;
    });
    const resolved = issues.filter((i) =>
      ["RESOLVED", "CLOSED"].includes(i.status),
    );
    const avgRes = resolved.length
      ? resolved.reduce(
          (s, i) => s + ((i.resolvedAt || now) - i.createdAt),
          0,
        ) /
        resolved.length /
        3600000
      : 0;

    return {
      total: issues.length,
      open: open.length,
      resolved: resolved.length,
      closed: issues.filter((i) => i.status === "CLOSED").length,
      overdue: overdue.length,
      critical: open.filter((i) => i.priority === "CRITICAL").length,
      avgResolutionHours: Math.round(avgRes * 10) / 10,
    };
  },

  groupBy(issues, key) {
    const map = {};
    issues.forEach((i) => {
      const v = i[key] || "Unknown";
      map[v] = (map[v] || 0) + 1;
    });
    return map;
  },

  renderBarChart(containerId, data, color) {
    const container = document.getElementById(containerId);
    const max = Math.max(...Object.values(data), 1);
    container.innerHTML =
      Object.entries(data)
        .map(
          ([label, count]) => `
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;">
                <span style="width:100px;font-size:0.875rem;text-align:right;">${label}</span>
                <div style="flex:1;background:var(--bg-secondary);border-radius:var(--radius);height:28px;overflow:hidden;">
                    <div style="width:${(count / max) * 100}%;background:${color};height:100%;border-radius:var(--radius);display:flex;align-items:center;padding-left:8px;color:white;font-size:0.8rem;font-weight:600;min-width:30px;">${count}</div>
                </div>
            </div>
        `,
        )
        .join("") || '<p class="empty-state">No data available.</p>';
  },

  renderAll() {
    const issues = Storage.getIssues();
    const stats = this.getStats();

    document.getElementById("stat-total").textContent = stats.total;
    document.getElementById("stat-open").textContent = stats.open;
    document.getElementById("stat-resolved").textContent = stats.resolved;
    document.getElementById("stat-overdue").textContent = stats.overdue;
    document.getElementById("stat-critical").textContent = stats.critical;
    document.getElementById("stat-avg").textContent =
      stats.avgResolutionHours + "h";

    this.renderBarChart(
      "chart-status",
      this.groupBy(issues, "status"),
      "var(--primary)",
    );
    this.renderBarChart(
      "chart-priority",
      this.groupBy(issues, "priority"),
      "var(--warning)",
    );
    this.renderBarChart(
      "chart-category",
      this.groupBy(issues, "category"),
      "var(--success)",
    );
    this.renderBarChart(
      "chart-building",
      this.groupBy(issues, "building"),
      "#7e22ce",
    );
  },
};
