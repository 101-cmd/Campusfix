const AdminModule = {
    initDashboard() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        const stats = Analytics.getStats();
        const issues = Storage.getIssues();
        const users = Storage.getUsers();
        const workers = Storage.getUsers().filter(u => u.role === 'WORKER');

        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-open').textContent = stats.open;
        document.getElementById('stat-resolved').textContent = stats.resolved;
        document.getElementById('stat-closed').textContent = stats.closed;
        document.getElementById('stat-overdue').textContent = stats.overdue;
        document.getElementById('stat-critical').textContent = stats.critical;

        const recurring = issues.filter(i => Issues.findRecurring(i.building, i.room, i.category).length > 1);
        document.getElementById('stat-recurring').textContent = new Set(recurring.map(i => i.building+i.room+i.category)).size;

        const recent = issues.sort((a,b) => b.createdAt - a.createdAt).slice(0,5);
        document.getElementById('recent-body').innerHTML = recent.map(i => {
            const r = users.find(u => u.id === i.reporterId);
            return `<tr>
                <td><a href="issue-details.html?id=${i.id}">${i.ref}</a></td>
                <td>${i.title}</td>
                <td>${r ? r.name : 'Unknown'}</td>
                <td><span class="badge badge-${i.priority.toLowerCase()}">${i.priority}</span></td>
                <td><span class="badge badge-${i.status.toLowerCase().replace(/_/g,'')}">${i.status.replace(/_/g,' ')}</span></td>
                <td><span class="badge badge-${Utils.getSLAStatus(i).toLowerCase().replace(/ /g,'')}">${Utils.getSLAStatus(i)}</span></td>
            </tr>`;
        }).join('');

        document.getElementById('workload-body').innerHTML = workers.map(w => {
            const count = issues.filter(i => i.assignedWorkerId === w.id && !['CLOSED','REJECTED'].includes(i.status)).length;
            return `<tr><td>${w.name}</td><td>${w.specialization || 'General'}</td><td>${count}</td></tr>`;
        }).join('') || '<tr><td colspan="3" class="empty-state">No workers.</td></tr>';

        Notifications.renderBell(user.id);
    },

    initIssues() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        Storage.getCategories().forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; document.getElementById('f-category').appendChild(o); });
        const workers = Storage.getUsers().filter(u => u.role === 'WORKER');
        workers.forEach(w => { const o = document.createElement('option'); o.value = w.id; o.textContent = w.name; document.getElementById('f-worker').appendChild(o); });

        const render = () => {
            const search = document.getElementById('search').value.toLowerCase();
            const fS = document.getElementById('f-status').value;
            const fP = document.getElementById('f-priority').value;
            const fC = document.getElementById('f-category').value;
            const fW = document.getElementById('f-worker').value;
            const fO = document.getElementById('f-overdue').checked;

            let issues = Storage.getIssues();
            if (search) issues = issues.filter(i => i.title.toLowerCase().includes(search) || i.ref.toLowerCase().includes(search));
            if (fS) issues = issues.filter(i => i.status === fS);
            if (fP) issues = issues.filter(i => i.priority === fP);
            if (fC) issues = issues.filter(i => i.category === fC);
            if (fW) issues = issues.filter(i => i.assignedWorkerId === fW);
            if (fO) issues = issues.filter(i => Utils.getSLAStatus(i) === 'OVERDUE');
            issues.sort((a,b) => b.createdAt - a.createdAt);
            Issues.renderTable(issues, 'issues-body', true, true);
        };

        ['search','f-status','f-priority','f-category','f-worker'].forEach(id => document.getElementById(id).addEventListener('input', render));
        document.getElementById('f-overdue').addEventListener('change', render);
        render();
    },

    initIssueDetails() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        const params = new URLSearchParams(window.location.search);
        const issue = Issues.getById(params.get('id'));
        if (!issue) { document.getElementById('detail-content').innerHTML = '<div class="empty-state"><h3>Issue not found.</h3><a href="issues.html">Back</a></div>'; return; }

        const users = Storage.getUsers();
        const reporter = users.find(u => u.id === issue.reporterId);
        const worker = users.find(u => u.id === issue.assignedWorkerId);
        const workers = users.filter(u => u.role === 'WORKER' && u.status === 'ACTIVE');
        const sla = Utils.getSLAStatus(issue);
        const duplicates = Issues.findDuplicates(issue);
        const recurring = Issues.findRecurring(issue.building, issue.room, issue.category);
        const history = Issues.getMaintenanceHistory(issue.building, issue.room);

        document.getElementById('detail-content').innerHTML = `
            <div class="card" style="margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:1rem;">
                    <div>
                        <h2>${issue.title}</h2>
                        <p style="color:var(--text-secondary)">${issue.ref} • Submitted ${Utils.formatDate(issue.createdAt)}</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <span class="badge badge-${issue.status.toLowerCase().replace(/_/g,'')}" style="font-size:0.9rem;padding:0.5rem 1rem;">${issue.status.replace(/_/g,' ')}</span>
                        <span class="badge badge-${issue.priority.toLowerCase()}" style="font-size:0.9rem;padding:0.5rem 1rem;">${issue.priority}</span>
                        <span class="badge badge-${sla.toLowerCase().replace(/ /g,'')}" style="font-size:0.9rem;padding:0.5rem 1rem;">${sla}</span>
                    </div>
                </div>
            </div>

            ${duplicates.length ? `<div class="card" style="margin-bottom:1.5rem;border:2px solid var(--warning);">
                <h3 class="card-title" style="color:var(--warning);"><span class="material-symbols-outlined" aria-hidden="true">warning</span> Possible Duplicate Issues</h3>
                ${duplicates.map(d => `<p><a href="issue-details.html?id=${d.id}">${d.ref}</a> - ${d.title} (${d.status})</p>`).join('')}
            </div>` : ''}

            ${recurring.length > 1 ? `<div class="card" style="margin-bottom:1.5rem;border:2px solid var(--danger);">
                <h3 class="card-title" style="color:var(--danger);"><span class="material-symbols-outlined" aria-hidden="true">autorenew</span> Recurring Issue Detected</h3>
                <p>${recurring.length} similar issues in ${issue.building} - ${issue.room} (${issue.category})</p>
                ${recurring.slice(0,3).map(r => `<p><a href="issue-details.html?id=${r.id}">${r.ref}</a> - ${r.title}</p>`).join('')}
            </div>` : ''}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:1rem;">Details</h3>
                    <p><strong>Description:</strong> ${issue.description}</p>
                    <p><strong>Category:</strong> ${issue.category}</p>
                    <p><strong>Location:</strong> ${issue.building} - ${issue.room}</p>
                    <p><strong>Reporter:</strong> ${reporter ? reporter.name : 'Unknown'}</p>
                    <p><strong>Worker:</strong> ${worker ? worker.name : 'Unassigned'}</p>
                    <p><strong>Deadline:</strong> ${Utils.formatDate(issue.deadline)}</p>
                </div>
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:1rem;">Admin Actions</h3>
                    ${issue.status === 'SUBMITTED' ? `
                        <button class="btn btn-success" id="btn-verify" style="margin-bottom:0.5rem;"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span> Verify Issue</button>
                        <button class="btn btn-danger" id="btn-reject" style="margin-bottom:0.5rem;"><span class="material-symbols-outlined" aria-hidden="true">cancel</span> Reject Issue</button>
                        <div id="reject-form" style="display:none;margin-top:0.5rem;">
                            <textarea class="form-control" id="reject-reason" placeholder="Rejection reason"></textarea>
                            <button class="btn btn-danger btn-sm" id="btn-reject-confirm" style="margin-top:0.5rem;">Confirm Reject</button>
                        </div>
                    ` : ''}
                    ${['SUBMITTED','VERIFIED','REOPENED'].includes(issue.status) ? `
                        <div class="form-group" style="margin-top:1rem;">
                            <label class="form-label">Assign Worker</label>
                            <select class="form-control" id="assign-worker">
                                <option value="">Select worker...</option>
                                ${workers.map(w => `<option value="${w.id}" ${issue.assignedWorkerId === w.id ? 'selected' : ''}>${w.name} (${w.specialization || 'General'})</option>`).join('')}
                            </select>
                            <button class="btn btn-primary btn-sm" id="btn-assign" style="margin-top:0.5rem;">Assign</button>
                        </div>
                    ` : ''}
                    <div class="form-group" style="margin-top:1rem;">
                        <label class="form-label">Change Priority</label>
                        <select class="form-control" id="change-priority">
                            ${Issues.PRIORITIES.map(p => `<option ${issue.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                        </select>
                        <button class="btn btn-outline btn-sm" id="btn-priority" style="margin-top:0.5rem;">Update Priority</button>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem;">
                <h3 class="card-title" style="margin-bottom:1rem;">Status Timeline</h3>
                ${Issues.renderTimeline(issue)}
            </div>

            ${history.length > 1 ? `<div class="card" style="margin-top:1.5rem;">
                <h3 class="card-title" style="margin-bottom:1rem;">Maintenance History (${issue.building} - ${issue.room})</h3>
                <table><thead><tr><th>Ref</th><th>Issue</th><th>Date</th><th>Status</th></tr></thead><tbody>
                ${history.filter(h => h.id !== issue.id).slice(0,5).map(h => `
                    <tr><td><a href="issue-details.html?id=${h.id}">${h.ref}</a></td><td>${h.title}</td><td>${Utils.formatShortDate(h.createdAt)}</td><td><span class="badge badge-${h.status.toLowerCase().replace(/_/g,'')}">${h.status}</span></td></tr>
                `).join('')}
                </tbody></table>
            </div>` : ''}
        `;

        // Bind admin actions
        const btnVerify = document.getElementById('btn-verify');
        if (btnVerify) btnVerify.onclick = () => { Issues.changeStatus(issue.id, 'VERIFIED', 'Verified by admin.', user.id); Utils.toast('Issue verified.', 'success'); setTimeout(() => location.reload(), 500); };

        const btnReject = document.getElementById('btn-reject');
        if (btnReject) btnReject.onclick = () => { document.getElementById('reject-form').style.display = 'block'; };

        const btnRejectConfirm = document.getElementById('btn-reject-confirm');
        if (btnRejectConfirm) btnRejectConfirm.onclick = () => {
            const reason = document.getElementById('reject-reason').value;
            if (!reason) { Utils.toast('Provide a reason.', 'error'); return; }
            Issues.changeStatus(issue.id, 'REJECTED', reason, user.id);
            Utils.toast('Issue rejected.', 'success');
            setTimeout(() => location.reload(), 500);
        };

        const btnAssign = document.getElementById('btn-assign');
        if (btnAssign) btnAssign.onclick = () => {
            const wId = document.getElementById('assign-worker').value;
            if (!wId) { Utils.toast('Select a worker.', 'error'); return; }
            Issues.assignWorker(issue.id, wId, user.id);
            Utils.toast('Worker assigned.', 'success');
            setTimeout(() => location.reload(), 500);
        };

        const btnPriority = document.getElementById('btn-priority');
        if (btnPriority) btnPriority.onclick = () => {
            Issues.changePriority(issue.id, document.getElementById('change-priority').value, user.id);
            Utils.toast('Priority updated.', 'success');
            setTimeout(() => location.reload(), 500);
        };
    },

    initWorkers() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        const render = () => {
            const workers = Storage.getUsers().filter(u => u.role === 'WORKER');
            const issues = Storage.getIssues();
            document.getElementById('workers-body').innerHTML = workers.length ? workers.map(w => {
                const load = issues.filter(i => i.assignedWorkerId === w.id && !['CLOSED','REJECTED'].includes(i.status)).length;
                return `<tr>
                    <td>${w.name}</td><td>${w.email}</td><td>${w.specialization || 'General'}</td>
                    <td><span class="badge badge-${w.status === 'ACTIVE' ? 'resolved' : 'rejected'}">${w.status}</span></td>
                    <td>${load}</td>
                    <td>
                        <button class="btn btn-sm btn-outline toggle-worker" data-id="${w.id}">${w.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                    </td>
                </tr>`;
            }).join('') : '<tr><td colspan="6" class="empty-state">No workers found.</td></tr>';

            document.querySelectorAll('.toggle-worker').forEach(btn => {
                btn.onclick = () => {
                    const users = Storage.getUsers();
                    const u = users.find(x => x.id === btn.dataset.id);
                    if (u) { u.status = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; Storage.saveUsers(users); Utils.toast(`Worker ${u.status}.`, 'success'); render(); }
                };
            });
        };

        document.getElementById('add-worker-form').onsubmit = (e) => {
            e.preventDefault();
            const users = Storage.getUsers();
            const email = document.getElementById('w-email').value;
            if (users.find(u => u.email === email)) { Utils.toast('Email exists.', 'error'); return; }
            users.push({
                id: Utils.generateId(), name: document.getElementById('w-name').value, email,
                password: 'password123', role: 'WORKER', specialization: document.getElementById('w-spec').value,
                status: 'ACTIVE'
            });
            Storage.saveUsers(users);
            Utils.toast('Worker added.', 'success');
            e.target.reset(); render();
        };
        render();
    },

    initCategories() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        const render = () => {
            const cats = Storage.getCategories();
            document.getElementById('cat-list').innerHTML = cats.map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 0;border-bottom:1px solid var(--border);">
                    <span>${c}</span>
                    <button class="btn btn-sm btn-danger del-cat" data-cat="${c}">Remove</button>
                </div>
            `).join('');

            document.querySelectorAll('.del-cat').forEach(btn => {
                btn.onclick = () => {
                    const issues = Storage.getIssues();
                    if (issues.some(i => i.category === btn.dataset.cat)) {
                        Utils.toast('Cannot remove: category in use by existing issues.', 'error');
                        return;
                    }
                    const cats = Storage.getCategories().filter(c => c !== btn.dataset.cat);
                    Storage.saveCategories(cats);
                    Utils.toast('Category removed.', 'success');
                    render();
                };
            });
        };

        document.getElementById('add-cat-form').onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('new-cat').value.trim();
            if (!name) return;
            const cats = Storage.getCategories();
            if (cats.includes(name)) { Utils.toast('Category exists.', 'error'); return; }
            cats.push(name);
            Storage.saveCategories(cats);
            Utils.toast('Category added.', 'success');
            e.target.reset(); render();
        };
        render();
    },

    initAnnouncements() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        const render = () => {
            const anns = Storage.getAnnouncements();
            document.getElementById('ann-body').innerHTML = anns.length ? anns.map(a => `
                <tr>
                    <td>${a.title}</td>
                    <td>${a.affectedArea || 'All'}</td>
                    <td><span class="badge badge-${a.active ? 'resolved' : 'rejected'}">${a.active ? 'Active' : 'Inactive'}</span></td>
                    <td>${Utils.formatShortDate(a.startDate)}</td>
                    <td>${Utils.formatShortDate(a.endDate)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline toggle-ann" data-id="${a.id}">${a.active ? 'Deactivate' : 'Activate'}</button>
                        <button class="btn btn-sm btn-danger del-ann" data-id="${a.id}">Delete</button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="6" class="empty-state">No announcements.</td></tr>';

            document.querySelectorAll('.toggle-ann').forEach(btn => {
                btn.onclick = () => {
                    const anns = Storage.getAnnouncements();
                    const a = anns.find(x => x.id === btn.dataset.id);
                    if (a) { a.active = !a.active; Storage.saveAnnouncements(anns); Utils.toast('Updated.', 'success'); render(); }
                };
            });
            document.querySelectorAll('.del-ann').forEach(btn => {
                btn.onclick = () => {
                    Storage.saveAnnouncements(Storage.getAnnouncements().filter(a => a.id !== btn.dataset.id));
                    Utils.toast('Deleted.', 'success'); render();
                };
            });
        };

        document.getElementById('add-ann-form').onsubmit = (e) => {
            e.preventDefault();
            const anns = Storage.getAnnouncements();
            anns.push({
                id: Utils.generateId(),
                title: document.getElementById('ann-title').value,
                content: document.getElementById('ann-content').value,
                affectedArea: document.getElementById('ann-area').value,
                active: true,
                startDate: new Date(document.getElementById('ann-start').value).getTime(),
                endDate: new Date(document.getElementById('ann-end').value).getTime()
            });
            Storage.saveAnnouncements(anns);
            Notifications.create('USER', `New announcement: ${document.getElementById('ann-title').value}`);
            Utils.toast('Announcement created.', 'success');
            e.target.reset(); render();
        };
        render();
    },

    initAnalytics() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);
        Analytics.renderAll();
    },

    initSLA() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        const sla = Storage.getSLASettings();
        document.getElementById('sla-low').value = sla.LOW;
        document.getElementById('sla-medium').value = sla.MEDIUM;
        document.getElementById('sla-high').value = sla.HIGH;
        document.getElementById('sla-critical').value = sla.CRITICAL;

        document.getElementById('sla-form').onsubmit = (e) => {
            e.preventDefault();
            Storage.saveSLASettings({
                LOW: parseInt(document.getElementById('sla-low').value),
                MEDIUM: parseInt(document.getElementById('sla-medium').value),
                HIGH: parseInt(document.getElementById('sla-high').value),
                CRITICAL: parseInt(document.getElementById('sla-critical').value)
            });
            Utils.toast('SLA settings saved.', 'success');
        };
    },

    initUsers() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);

        const render = () => {
            const users = Storage.getUsers().filter(u => u.role === 'USER');
            document.getElementById('users-body').innerHTML = users.length ? users.map(u => `
                <tr>
                    <td>${u.name}</td><td>${u.email}</td><td>${u.studentId || 'N/A'}</td>
                    <td>${u.department || 'N/A'}</td>
                    <td><span class="badge badge-${u.status === 'ACTIVE' ? 'resolved' : 'rejected'}">${u.status}</span></td>
                    <td><button class="btn btn-sm btn-outline toggle-user" data-id="${u.id}">${u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
            `).join('') : '<tr><td colspan="6" class="empty-state">No users.</td></tr>';

            document.querySelectorAll('.toggle-user').forEach(btn => {
                btn.onclick = () => {
                    const users = Storage.getUsers();
                    const u = users.find(x => x.id === btn.dataset.id);
                    if (u) { u.status = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; Storage.saveUsers(users); Utils.toast(`User ${u.status}.`, 'success'); render(); }
                };
            });
        };
        render();
    },

    initNotifications() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);
        Notifications.renderList(user.id, 'notif-list');
        document.getElementById('btn-mark-all').onclick = () => {
            Notifications.markAllRead(user.id);
            Notifications.renderBell(user.id);
            Notifications.renderList(user.id, 'notif-list');
            Utils.toast('All marked as read.', 'success');
        };
    },

    initProfile() {
        const user = Auth.requireRole('ADMIN');
        if (!user) return;
        App.init('ADMIN');
        Notifications.renderBell(user.id);
        document.getElementById('profile-name').textContent = user.name;
        document.getElementById('profile-email').textContent = user.email;
        document.getElementById('profile-role').textContent = user.role;
    }
};
