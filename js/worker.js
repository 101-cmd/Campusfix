const WorkerModule = {
  initDashboard() {
    const user = Auth.requireRole("WORKER");
    if (!user) return;
    App.init("WORKER");
    const issues = Storage.getIssues().filter(
      (i) => i.assignedWorkerId === user.id,
    );
    const sla = Storage.getSLASettings();
    const now = Date.now();

    document.getElementById("stat-assigned").textContent = issues.filter((i) =>
      ["ASSIGNED", "IN_PROGRESS"].includes(i.status),
    ).length;
    document.getElementById("stat-progress").textContent = issues.filter(
      (i) => i.status === "IN_PROGRESS",
    ).length;
    document.getElementById("stat-resolved").textContent = issues.filter(
      (i) => i.status === "RESOLVED",
    ).length;
    document.getElementById("stat-overdue").textContent = issues.filter((i) => {
      if (["CLOSED", "REJECTED", "RESOLVED"].includes(i.status)) return false;
      return now > i.createdAt + (sla[i.priority] || 48) * 3600000;
    }).length;

    const recent = issues.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const tbody = document.getElementById("recent-body");
    tbody.innerHTML = recent.length
      ? recent
          .map(
            (i) => `
            <tr>
                <td><a href="issue-details.html?id=${i.id}">${i.ref}</a></td>
                <td>${i.title}</td>
                <td>${i.building} - ${i.room}</td>
                <td><span class="badge badge-${i.priority.toLowerCase()}">${i.priority}</span></td>
                <td><span class="badge badge-${i.status.toLowerCase().replace(/_/g, "")}">${i.status.replace(/_/g, " ")}</span></td>
            </tr>
        `,
          )
          .join("")
      : '<tr><td colspan="5" class="empty-state">No assigned issues.</td></tr>';

    Notifications.renderBell(user.id);
  },

  initIssues() {
    const user = Auth.requireRole("WORKER");
    if (!user) return;
    App.init("WORKER");
    Notifications.renderBell(user.id);

    const render = () => {
      const fStatus = document.getElementById("f-status").value;
      let issues = Storage.getIssues().filter(
        (i) => i.assignedWorkerId === user.id,
      );
      if (fStatus) issues = issues.filter((i) => i.status === fStatus);
      issues.sort((a, b) => b.createdAt - a.createdAt);
      Issues.renderTable(issues, "issues-body", false, false);
    };
    document.getElementById("f-status").addEventListener("change", render);
    render();
  },

  initIssueDetails() {
    const user = Auth.requireRole("WORKER");
    if (!user) return;
    App.init("WORKER");
    Notifications.renderBell(user.id);

    const params = new URLSearchParams(window.location.search);
    const issue = Issues.getById(params.get("id"));
    if (!issue || issue.assignedWorkerId !== user.id) {
      document.getElementById("detail-content").innerHTML =
        '<div class="empty-state"><h3>Issue not found or not assigned to you.</h3><a href="issues.html">Back</a></div>';
      return;
    }

    const reporter = Storage.getUsers().find((u) => u.id === issue.reporterId);
    const sla = Utils.getSLAStatus(issue);

    document.getElementById("detail-content").innerHTML = `
            <div class="card" style="margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:1rem;">
                    <div>
                        <h2>${issue.title}</h2>
                        <p style="color:var(--text-secondary)">${issue.ref} • ${issue.category}</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <span class="badge badge-${issue.status.toLowerCase().replace(/_/g, "")}" style="font-size:0.9rem;padding:0.5rem 1rem;">${issue.status.replace(/_/g, " ")}</span>
                        <span class="badge badge-${sla.toLowerCase().replace(/ /g, "")}" style="font-size:0.9rem;padding:0.5rem 1rem;">${sla}</span>
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:1rem;">Issue Info</h3>
                    <p><strong>Description:</strong> ${issue.description}</p>
                    <p><strong>Location:</strong> ${issue.building} - ${issue.room}</p>
                    <p><strong>Priority:</strong> ${issue.priority}</p>
                    <p><strong>Reporter:</strong> ${reporter ? reporter.name : "Unknown"}</p>
                    <p><strong>Deadline:</strong> ${Utils.formatDate(issue.deadline)}</p>
                </div>
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:1rem;">Timeline</h3>
                    ${Issues.renderTimeline(issue)}
                </div>
            </div>
            ${
              issue.progressNotes.length
                ? `<div class="card" style="margin-top:1.5rem;">
                <h3 class="card-title" style="margin-bottom:1rem;">Progress Notes</h3>
                ${issue.progressNotes.map((n) => `<div style="padding:0.5rem 0;border-bottom:1px solid var(--border);"><p>${n.note}</p><small>${Utils.formatDate(n.date)}</small></div>`).join("")}
            </div>`
                : ""
            }
            <div class="card" style="margin-top:1.5rem;">
                <h3 class="card-title" style="margin-bottom:1rem;">Actions</h3>
                <div id="worker-actions">
                    ${issue.status === "ASSIGNED" ? `<button class="btn btn-primary" id="btn-start">▶ START WORK</button>` : ""}
                    ${
                      ["ASSIGNED", "IN_PROGRESS"].includes(issue.status)
                        ? `
                        <div style="margin-top:1rem;">
                            <div class="form-group"><label class="form-label">Add Progress Note</label><textarea class="form-control" id="progress-note"></textarea></div>
                            <button class="btn btn-outline" id="btn-progress">Add Note</button>
                        </div>
                        <button class="btn btn-success" id="btn-resolve" style="margin-top:1rem;"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span> MARK RESOLVED</button>
                    `
                        : ""
                    }
                    ${issue.status === "RESOLVED" ? '<p style="color:var(--success);font-weight:600;">Awaiting reporter verification.</p>' : ""}
                    ${
                      issue.status === "REOPENED"
                        ? `
                        <p style="color:var(--danger);font-weight:600;margin-bottom:1rem;">Issue reopened by reporter. Please address and resolve again.</p>
                        <button class="btn btn-primary" id="btn-start">▶ RESUME WORK</button>
                    `
                        : ""
                    }
                </div>
            </div>
        `;

    const btnStart = document.getElementById("btn-start");
    if (btnStart)
      btnStart.onclick = () => {
        Issues.changeStatus(
          issue.id,
          "IN_PROGRESS",
          "Worker started work.",
          user.id,
        );
        Utils.toast("Work started.", "success");
        setTimeout(() => location.reload(), 500);
      };

    const btnProgress = document.getElementById("btn-progress");
    if (btnProgress)
      btnProgress.onclick = () => {
        const note = document.getElementById("progress-note").value;
        if (!note) {
          Utils.toast("Please enter a note.", "error");
          return;
        }
        Issues.addProgressNote(issue.id, note, user.id);
        Utils.toast("Progress note added.", "success");
        setTimeout(() => location.reload(), 500);
      };

    const btnResolve = document.getElementById("btn-resolve");
    if (btnResolve)
      btnResolve.onclick = () => {
        const note =
          document.getElementById("progress-note")?.value || "Issue resolved.";
        Issues.changeStatus(
          issue.id,
          "RESOLVED",
          note || "Marked resolved by worker.",
          user.id,
        );
        Utils.toast(
          "Issue marked as resolved. Awaiting reporter verification.",
          "success",
        );
        setTimeout(() => location.reload(), 500);
      };
  },

  initProfile() {
    const user = Auth.requireRole("WORKER");
    if (!user) return;
    App.init("WORKER");
    Notifications.renderBell(user.id);
    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-spec").textContent =
      user.specialization || "General";
    document.getElementById("profile-status").textContent = user.status;
  },
};
