const UserModule = {
  initDashboard() {
    const user = Auth.requireRole("USER");
    if (!user) return;
    App.init("USER");
    const issues = Storage.getIssues().filter((i) => i.reporterId === user.id);
    const open = issues.filter(
      (i) => !["CLOSED", "REJECTED"].includes(i.status),
    );
    const resolved = issues.filter((i) => i.status === "RESOLVED");
    const closed = issues.filter((i) => i.status === "CLOSED");

    document.getElementById("stat-total").textContent = issues.length;
    document.getElementById("stat-open").textContent = open.length;
    document.getElementById("stat-resolved").textContent = closed.length;
    document.getElementById("stat-verify").textContent = resolved.length;

    const recent = issues.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const tbody = document.getElementById("recent-issues-body");
    if (recent.length) {
      tbody.innerHTML = recent
        .map(
          (i) => `
                <tr>
                    <td><a href="issue-details.html?id=${i.id}">${i.ref}</a></td>
                    <td>${i.title}</td>
                    <td><span class="badge badge-${i.priority.toLowerCase()}">${i.priority}</span></td>
                    <td><span class="badge badge-${i.status.toLowerCase().replace(/_/g, "")}">${i.status.replace(/_/g, " ")}</span></td>
                    <td>${Utils.formatShortDate(i.createdAt)}</td>
                </tr>
            `,
        )
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-state">No issues reported yet. <a href="report.html">Report one now.</a></td></tr>';
    }

    const anns = Storage.getAnnouncements().filter(
      (a) => a.active && Date.now() >= a.startDate && Date.now() <= a.endDate,
    );
    document.getElementById("announcements").innerHTML = anns.length
      ? anns
          .map(
            (a) => `
            <div style="padding:0.75rem 0;border-bottom:1px solid var(--border);">
                <strong>${a.title}</strong>
                <p style="font-size:0.875rem;color:var(--text-secondary)">${a.content}</p>
                <small>${a.affectedArea || "All areas"}</small>
            </div>
        `,
          )
          .join("")
      : '<p class="empty-state">No active announcements.</p>';

    Notifications.renderBell(user.id);
  },

  initIssues() {
    const user = Auth.requireRole("USER");
    if (!user) return;
    App.init("USER");
    Notifications.renderBell(user.id);

    const render = () => {
      const search = document.getElementById("search").value.toLowerCase();
      const fStatus = document.getElementById("f-status").value;
      const fPriority = document.getElementById("f-priority").value;
      let issues = Storage.getIssues().filter((i) => i.reporterId === user.id);
      if (search)
        issues = issues.filter(
          (i) =>
            i.title.toLowerCase().includes(search) ||
            i.ref.toLowerCase().includes(search),
        );
      if (fStatus) issues = issues.filter((i) => i.status === fStatus);
      if (fPriority) issues = issues.filter((i) => i.priority === fPriority);
      issues.sort((a, b) => b.createdAt - a.createdAt);
      Issues.renderTable(issues, "issues-body", false, false);
    };

    ["search", "f-status", "f-priority"].forEach((id) =>
      document.getElementById(id).addEventListener("input", render),
    );
    render();
  },

  initIssueDetails() {
    const user = Auth.requireRole("USER");
    if (!user) return;
    App.init("USER");
    Notifications.renderBell(user.id);

    const params = new URLSearchParams(window.location.search);
    const issue = Issues.getById(params.get("id"));
    if (!issue) {
      document.getElementById("detail-content").innerHTML =
        '<div class="empty-state"><h3>Issue not found</h3><a href="issues.html">Back to issues</a></div>';
      return;
    }
    if (issue.reporterId !== user.id) {
      document.getElementById("detail-content").innerHTML =
        '<div class="empty-state"><h3>Unauthorized</h3></div>';
      return;
    }

    const users = Storage.getUsers();
    const reporter = users.find((u) => u.id === issue.reporterId);
    const worker = users.find((u) => u.id === issue.assignedWorkerId);
    const sla = Utils.getSLAStatus(issue);

    document.getElementById("detail-content").innerHTML = `
            <div class="card" style="margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:1rem;">
                    <div>
                        <h2>${issue.title}</h2>
                        <p style="color:var(--text-secondary)">${issue.ref} • Submitted ${Utils.formatDate(issue.createdAt)}</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <span class="badge badge-${issue.status.toLowerCase().replace(/_/g, "")}" style="font-size:0.9rem;padding:0.5rem 1rem;">${issue.status.replace(/_/g, " ")}</span>
                        <span class="badge badge-${issue.priority.toLowerCase()}" style="font-size:0.9rem;padding:0.5rem 1rem;">${issue.priority}</span>
                        <span class="badge badge-${sla.toLowerCase().replace(/ /g, "")}" style="font-size:0.9rem;padding:0.5rem 1rem;">${sla}</span>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:1rem;">Details</h3>
                    <p><strong>Description:</strong> ${issue.description}</p>
                    <p><strong>Category:</strong> ${issue.category}</p>
                    <p><strong>Location:</strong> ${issue.building} - ${issue.room}</p>
                    <p><strong>Deadline:</strong> ${Utils.formatDate(issue.deadline)}</p>
                    <p><strong>Assigned Worker:</strong> ${worker ? worker.name : "Not yet assigned"}</p>
                </div>
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:1rem;">Status Timeline</h3>
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

            ${
              issue.status === "RESOLVED"
                ? `<div class="card" style="margin-top:1.5rem;border:2px solid var(--success);">
                <h3 class="card-title" style="margin-bottom:1rem;"><span class="material-symbols-outlined" aria-hidden="true">task_alt</span> Has this issue been fixed?</h3>
                <p style="margin-bottom:1rem;">A worker has marked this issue as resolved. Please verify the repair.</p>
                <div style="display:flex;gap:1rem;">
                    <button class="btn btn-success" id="btn-verify-yes">YES, CLOSE ISSUE</button>
                    <button class="btn btn-danger" id="btn-verify-no">NO, REOPEN ISSUE</button>
                </div>
                <div id="reopen-form" style="display:none;margin-top:1rem;">
                    <div class="form-group"><label class="form-label">Reason for reopening</label><textarea class="form-control" id="reopen-reason" required></textarea></div>
                    <button class="btn btn-danger" id="btn-reopen-confirm">Confirm Reopen</button>
                </div>
            </div>`
                : ""
            }
        `;

    if (issue.status === "RESOLVED") {
      document.getElementById("btn-verify-yes").onclick = () => {
        Issues.verify(issue.id, true, "", user.id);
        Utils.toast("Issue closed. Thank you for verifying!", "success");
        setTimeout(() => location.reload(), 500);
      };
      document.getElementById("btn-verify-no").onclick = () => {
        document.getElementById("reopen-form").style.display = "block";
      };
      document.getElementById("btn-reopen-confirm").onclick = () => {
        const reason = document.getElementById("reopen-reason").value;
        if (!reason) {
          Utils.toast("Please provide a reason.", "error");
          return;
        }
        Issues.verify(issue.id, false, reason, user.id);
        Utils.toast("Issue reopened.", "success");
        setTimeout(() => location.reload(), 500);
      };
    }
  },

  initReport() {
    const user = Auth.requireRole("USER");
    if (!user) return;
    App.init("USER");
    Notifications.renderBell(user.id);

    const catSelect = document.getElementById("category");
    Storage.getCategories().forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      catSelect.appendChild(o);
    });

    document.getElementById("description").addEventListener("input", () => {
      document.getElementById("priority").value = Utils.suggestPriority(
        document.getElementById("category").value,
        document.getElementById("description").value,
      );
    });
    document.getElementById("category").addEventListener("change", () => {
      document.getElementById("priority").value = Utils.suggestPriority(
        document.getElementById("category").value,
        document.getElementById("description").value,
      );
    });

    document.getElementById("report-form").onsubmit = (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.textContent = "Submitting...";
      btn.disabled = true;

      setTimeout(() => {
        const data = {
          title: document.getElementById("title").value,
          description: document.getElementById("description").value,
          category: document.getElementById("category").value,
          building: document.getElementById("building").value,
          room: document.getElementById("room").value,
          priority: document.getElementById("priority").value,
        };

        const dup = Utils.checkDuplicate(data);
        if (dup)
          Utils.toast(`Warning: Possible duplicate of ${dup.ref}`, "error");

        const issue = Issues.create(data, user.id);
        Utils.toast(`Issue ${issue.ref} reported successfully!`, "success");
        setTimeout(
          () => (window.location.href = "issue-details.html?id=" + issue.id),
          800,
        );
      }, 600);
    };
  },

  initProfile() {
    const user = Auth.requireRole("USER");
    if (!user) return;
    App.init("USER");
    Notifications.renderBell(user.id);

    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-id").textContent = user.studentId || "N/A";
    document.getElementById("profile-dept").textContent =
      user.department || "N/A";
    document.getElementById("profile-phone").textContent = user.phone || "N/A";
  },
};
