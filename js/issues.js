const Issues = {
  STATUSES: [
    "SUBMITTED",
    "VERIFIED",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REJECTED",
    "REOPENED",
  ],
  PRIORITIES: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],

  getAll() {
    return Storage.getIssues();
  },

  getById(id) {
    return Storage.getIssues().find((i) => i.id === id);
  },

  create(data, reporterId) {
    const issues = Storage.getIssues();
    const sla = Storage.getSLASettings();
    const hours = sla[data.priority] || 48;
    const now = Date.now();
    const issue = {
      id: Utils.generateId(),
      ref: Utils.generateRef(),
      title: data.title,
      description: data.description,
      category: data.category,
      building: data.building,
      room: data.room,
      priority:
        data.priority || Utils.suggestPriority(data.category, data.description),
      status: "SUBMITTED",
      reporterId,
      assignedWorkerId: null,
      deadline: now + hours * 3600000,
      createdAt: now,
      resolvedAt: null,
      closedAt: null,
      attachments: data.attachments || [],
      history: [
        {
          status: "SUBMITTED",
          date: now,
          note: "Issue submitted.",
          by: reporterId,
        },
      ],
      progressNotes: [],
      verification: null,
      rejectionReason: null,
    };
    issues.push(issue);
    Storage.saveIssues(issues);
    Notifications.create(
      "ADMIN",
      `New issue reported: ${issue.ref} - ${issue.title}`,
    );
    return issue;
  },

  changeStatus(issueId, newStatus, note, byUserId) {
    const issues = Storage.getIssues();
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx === -1) return null;
    const issue = issues[idx];
    const oldStatus = issue.status;
    issue.status = newStatus;
    issue.history.push({
      status: newStatus,
      date: Date.now(),
      note: note || `Status changed to ${newStatus}`,
      by: byUserId,
    });

    if (newStatus === "RESOLVED") issue.resolvedAt = Date.now();
    if (newStatus === "CLOSED") issue.closedAt = Date.now();

    issues[idx] = issue;
    Storage.saveIssues(issues);

    // Notifications
    if (newStatus === "VERIFIED") {
      Notifications.create(
        issue.reporterId,
        `Your issue ${issue.ref} has been verified.`,
      );
    } else if (newStatus === "REJECTED") {
      Notifications.create(
        issue.reporterId,
        `Your issue ${issue.ref} has been rejected. Reason: ${note}`,
      );
    } else if (newStatus === "ASSIGNED") {
      Notifications.create(
        issue.assignedWorkerId,
        `New issue assigned: ${issue.ref}`,
      );
      Notifications.create(
        issue.reporterId,
        `Worker assigned to your issue ${issue.ref}.`,
      );
    } else if (newStatus === "IN_PROGRESS") {
      Notifications.create(
        issue.reporterId,
        `Work has started on ${issue.ref}.`,
      );
    } else if (newStatus === "RESOLVED") {
      Notifications.create(
        issue.reporterId,
        `Issue ${issue.ref} marked resolved. Please verify.`,
      );
    } else if (newStatus === "CLOSED") {
      Notifications.create(
        issue.assignedWorkerId,
        `Issue ${issue.ref} has been closed.`,
      );
    } else if (newStatus === "REOPENED") {
      Notifications.create(
        issue.assignedWorkerId,
        `Issue ${issue.ref} has been reopened.`,
      );
      Notifications.create("ADMIN", `Issue ${issue.ref} reopened by reporter.`);
    }
    return issue;
  },

  assignWorker(issueId, workerId, byUserId) {
    const issues = Storage.getIssues();
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx === -1) return;
    issues[idx].assignedWorkerId = workerId;
    issues[idx].history.push({
      status: "ASSIGNED",
      date: Date.now(),
      note: "Worker assigned.",
      by: byUserId,
    });
    issues[idx].status = "ASSIGNED";
    Storage.saveIssues(issues);
    const issue = issues[idx];
    Notifications.create(
      workerId,
      `New issue assigned: ${issue.ref} - ${issue.title}`,
    );
    Notifications.create(
      issue.reporterId,
      `A worker has been assigned to ${issue.ref}.`,
    );
  },

  changePriority(issueId, newPriority, byUserId) {
    const issues = Storage.getIssues();
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx === -1) return;
    const old = issues[idx].priority;
    issues[idx].priority = newPriority;
    const sla = Storage.getSLASettings();
    issues[idx].deadline =
      issues[idx].createdAt + (sla[newPriority] || 48) * 3600000;
    issues[idx].history.push({
      status: issues[idx].status,
      date: Date.now(),
      note: `Priority changed from ${old} to ${newPriority}`,
      by: byUserId,
    });
    Storage.saveIssues(issues);
    Notifications.create(
      issues[idx].reporterId,
      `Priority of ${issues[idx].ref} changed to ${newPriority}.`,
    );
  },

  addProgressNote(issueId, note, byUserId) {
    const issues = Storage.getIssues();
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx === -1) return;
    issues[idx].progressNotes.push({ note, date: Date.now(), by: byUserId });
    issues[idx].history.push({
      status: "IN_PROGRESS",
      date: Date.now(),
      note: `Progress: ${note}`,
      by: byUserId,
    });
    Storage.saveIssues(issues);
  },

  verify(issueId, approved, reason, byUserId) {
    if (approved) {
      this.changeStatus(
        issueId,
        "CLOSED",
        "Reporter verified the repair.",
        byUserId,
      );
      const issues = Storage.getIssues();
      const issue = issues.find((i) => i.id === issueId);
      if (issue) {
        issue.verification = { approved: true, date: Date.now(), by: byUserId };
        Storage.saveIssues(issues);
      }
    } else {
      this.changeStatus(
        issueId,
        "REOPENED",
        `Reporter rejected repair: ${reason}`,
        byUserId,
      );
      const issues = Storage.getIssues();
      const issue = issues.find((i) => i.id === issueId);
      if (issue) {
        issue.verification = {
          approved: false,
          reason,
          date: Date.now(),
          by: byUserId,
        };
        Storage.saveIssues(issues);
      }
    }
  },

  findDuplicates(issue) {
    return Storage.getIssues().filter(
      (i) =>
        i.id !== issue.id &&
        i.status !== "CLOSED" &&
        i.status !== "REJECTED" &&
        i.category === issue.category &&
        i.building === issue.building &&
        i.room === issue.room &&
        Date.now() - i.createdAt < 86400000,
    );
  },

  findRecurring(building, room, category) {
    return Storage.getIssues().filter(
      (i) =>
        i.building === building &&
        i.room === room &&
        i.category === category &&
        (i.status === "CLOSED" || i.status === "RESOLVED"),
    );
  },

  getMaintenanceHistory(building, room) {
    return Storage.getIssues()
      .filter((i) => i.building === building && i.room === room)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  renderTable(issues, containerId, showReporter, showWorker) {
    const users = Storage.getUsers();
    const container = document.getElementById(containerId);
    if (!issues.length) {
      container.innerHTML =
        '<tr><td colspan="9" class="empty-state">No maintenance issues found.</td></tr>';
      return;
    }
    container.innerHTML = issues
      .map((i) => {
        const reporter = users.find((u) => u.id === i.reporterId);
        const worker = users.find((u) => u.id === i.assignedWorkerId);
        const sla = Utils.getSLAStatus(i);
        return `<tr>
                <td><a href="issue-details.html?id=${i.id}">${i.ref}</a></td>
                <td>${i.title}</td>
                <td>${i.category}</td>
                <td>${i.building} - ${i.room}</td>
                ${showReporter ? `<td>${reporter ? reporter.name : "Unknown"}</td>` : ""}
                <td><span class="badge badge-${i.priority.toLowerCase()}">${i.priority}</span></td>
                <td><span class="badge badge-${i.status.toLowerCase().replace(/_/g, "")}">${i.status.replace(/_/g, " ")}</span></td>
                ${showWorker ? `<td>${worker ? worker.name : "Unassigned"}</td>` : ""}
                <td><span class="badge badge-${sla.toLowerCase().replace(/ /g, "")}">${sla}</span></td>
                <td><a href="issue-details.html?id=${i.id}" class="btn btn-sm btn-outline">View</a></td>
            </tr>`;
      })
      .join("");
  },

  renderTimeline(issue) {
    return `<div class="timeline">${issue.history
      .map(
        (h) => `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <strong>${h.status.replace(/_/g, " ")}</strong>
                    <p>${h.note || ""}</p>
                    <span class="timeline-date">${Utils.formatDate(h.date)}</span>
                </div>
            </div>
        `,
      )
      .join("")}</div>`;
  },
};
