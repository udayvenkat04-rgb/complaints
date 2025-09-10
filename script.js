/* Complaint Management Portal - JS (localStorage based) */

/* ---------- Utility ---------- */
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const formatDateTime = ts => {
  const d = new Date(ts);
  return d.toLocaleString();
};

const uid = (prefix = 'id') => prefix + '_' + Math.random().toString(36).slice(2, 9);

/* ---------- Storage keys & init ---------- */
const K_USERS = 'cmp_users_v1';
const K_COMPLAINTS = 'cmp_complaints_v1';
const K_CURRENT = 'cmp_current_user_v1';

function load(key) {
  return JSON.parse(localStorage.getItem(key) || 'null');
}
function save(key, v) {
  localStorage.setItem(key, JSON.stringify(v));
}

/* Create default admin + sample staff on first run */
function ensureDefaults() {
  let users = load(K_USERS);
  if (!users) {
    users = [{
      id: uid('u'),
      name: 'Admin',
      email: 'admin@cmp.com',
      password: 'admin123',
      role: 'admin'
    }, {
      id: uid('u'),
      name: 'Staff One',
      email: 'staff1@cmp.com',
      password: 'staff123',
      role: 'staff'
    }, {
      id: uid('u'),
      name: 'Staff Two',
      email: 'staff2@cmp.com',
      password: 'staff123',
      role: 'staff'
    }, {
      id: uid('u'),
      name: 'Demo User',
      email: 'user1@cmp.com',
      password: 'user123',
      role: 'user'
    }, ];
    save(K_USERS, users);
    save(K_COMPLAINTS, []);
  }
}
ensureDefaults();

/* ---------- Navigation & View management ---------- */
function showView(id) {
  qsa('.view').forEach(v => v.classList.remove('active'));
  qs(`#view-${id}`).classList.add('active');
  updateTopControls();
}

function showSubview(view, sub) {
  qsa(`#view-${view} .subview`).forEach(s => s.classList.add('hidden'));
  qs(`#${sub}`).classList.remove('hidden');
}

/* ---------- Auth ---------- */
function setCurrent(user) {
  if (user) save(K_CURRENT, user);
  else localStorage.removeItem(K_CURRENT);
  updateTopControls();
}

function getCurrent() {
  return load(K_CURRENT);
}

function logout() {
  setCurrent(null);
  showView('login');
}

/* ---------- Top controls & header ---------- */
function updateTopControls() {
  const top = qs('#top-controls');
  top.innerHTML = '';
  const user = getCurrent();
  if (!user) {
    const span = document.createElement('span');
    span.className = 'small';
    span.textContent = 'Please login or register';
    top.appendChild(span);
    return;
  }
  const name = document.createElement('span');
  name.textContent = `${user.name} (${user.role})`;
  name.style.marginRight = '12px';
  name.className = 'small';
  top.appendChild(name);

  const btn = document.createElement('button');
  btn.textContent = 'Logout';
  btn.onclick = logout;
  top.appendChild(btn);
}

/* ---------- Event wiring ---------- */
function initEvents() {
  // links
  qs('#link-register').onclick = (e) => {
    e.preventDefault();
    showView('register');
  };
  qs('#link-login').onclick = (e) => {
    e.preventDefault();
    showView('login');
  };

  // register
  qs('#btn-register').onclick = registerUser;
  qs('#btn-login').onclick = loginUser;

  // navigation inside dashboards
  qsa('.nav-btn').forEach(b => b.addEventListener('click', e => {
    const t = e.currentTarget.dataset.target;
    if (qs('#view-user').classList.contains('active')) showSubview('user', t);
    if (qs('#view-admin').classList.contains('active')) showSubview('admin', t);
    if (qs('#view-staff').classList.contains('active')) showSubview('staff', t);
    if (t === 'user-history') renderUserComplaints();
    if (t === 'admin-all-complaints') renderAdminComplaints();
    if (t === 'admin-manage-staff') renderStaffList();
    if (t === 'staff-assigned') renderStaffComplaints();
  }));

  // complaint submit
  qs('#btn-submit-complaint').onclick = submitComplaint;

  // user search
  if (qs('#user-search')) qs('#user-search').oninput = renderUserComplaints;

  // admin filters
  if (qs('#btn-filter')) qs('#btn-filter').onclick = renderAdminComplaints;
  if (qs('#btn-clear-filter')) qs('#btn-clear-filter').onclick = () => {
    qs('#filter-status').value = '';
    qs('#filter-category').value = '';
    qs('#filter-from').value = '';
    qs('#filter-to').value = '';
    renderAdminComplaints();
  };

  // add staff
  if (qs('#btn-add-staff')) qs('#btn-add-staff').onclick = addStaff;

  // modal
  if (qs('#modal-close')) qs('#modal-close').onclick = closeModal;
  if (qs('#modal')) qs('#modal').onclick = (e) => {
    if (e.target.id === 'modal') closeModal();
  };

  // storage event to sync across tabs
  window.addEventListener('storage', e => {
    if ([K_USERS, K_COMPLAINTS, K_CURRENT].includes(e.key)) {
      refreshCurrentView();
    }
  });

  const cur = getCurrent();
  if (cur) {
    routeToRoleView(cur.role);
  } else {
    showView('login');
  }
  updateTopControls();
}

/* ---------- Auth implementations ---------- */
function registerUser() {
  const name = qs('#reg-name').value.trim();
  const email = qs('#reg-email').value.trim().toLowerCase();
  const pwd = qs('#reg-password').value;
  const role = qs('#reg-role').value;

  const msg = qs('#reg-msg');
  msg.textContent = '';
  if (!name || !email || !pwd) {
    msg.textContent = 'Please fill all fields';
    return;
  }

  const users = load(K_USERS) || [];
  if (users.find(u => u.email === email)) {
    msg.textContent = 'Email already registered';
    return;
  }

  const u = {
    id: uid('u'),
    name,
    email,
    password: pwd,
    role
  };
  users.push(u);
  save(K_USERS, users);
  msg.style.color = 'green';
  msg.textContent = 'Registered. You can login now.';
  setTimeout(() => {
    showView('login');
  }, 900);
}

function loginUser() {
  const email = qs('#login-email').value.trim().toLowerCase();
  const pwd = qs('#login-password').value;
  const expectedRole = qs('#login-role').value;

  const msg = qs('#login-msg');
  msg.textContent = '';
  if (!email || !pwd) {
    msg.textContent = 'Fill email and password';
    return;
  }

  const users = load(K_USERS) || [];
  const u = users.find(x => x.email === email && x.password === pwd && x.role === expectedRole);
  if (!u) {
    msg.textContent = 'Invalid credentials / role';
    return;
  }

  setCurrent(u);
  routeToRoleView(u.role);
}

/* ---------- Routing by role ---------- */
function routeToRoleView(role) {
  if (role === 'admin') {
    showView('admin');
    renderAdminComplaints();
    renderStaffList();
    renderAnalytics();
  } else if (role === 'staff') {
    showView('staff');
    renderStaffComplaints();
  } else {
    showView('user');
    showSubview('user', 'user-new-complaint');
    renderUserComplaints();
  }
}

/* ---------- Complaints management ---------- */
function submitComplaint() {
  const title = qs('#c-title').value.trim();
  const desc = qs('#c-desc').value.trim();
  const category = qs('#c-category').value.trim();
  const location = qs('#c-location').value.trim();
  const date = qs('#c-date').value;
  const msg = qs('#submit-msg');
  msg.style.color = 'red';
  msg.textContent = '';

  if (!title || !desc || !category || !location || !date) {
    msg.textContent = 'Please fill all fields';
    return;
  }
  const user = getCurrent();
  if (!user || user.role !== 'user') {
    msg.textContent = 'Only logged-in users can submit';
    return;
  }

  const complaints = load(K_COMPLAINTS) || [];
  const newC = {
    id: uid('c'),
    title,
    desc,
    category,
    location,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString(),
    incidentDate: date,
    status: 'Pending',
    assignedTo: null,
    assignedToName: null,
    history: [{
      status: 'Pending',
      by: user.id,
      at: new Date().toISOString(),
      note: 'Created'
    }],
    remarks: []
  };
  complaints.unshift(newC);
  save(K_COMPLAINTS, complaints);
  msg.style.color = 'green';
  msg.textContent = 'Complaint submitted';
  // clear
  qs('#c-title').value = '';
  qs('#c-desc').value = '';
  qs('#c-category').value = '';
  qs('#c-location').value = '';
  qs('#c-date').value = '';
  renderUserComplaints();
  renderAdminComplaints();
  renderAnalytics();
}

/* render user complaints */
function renderUserComplaints() {
  const user = getCurrent();
  if (!user) return;
  const list = qs('#user-complaints-list');
  list.innerHTML = '';
  const complaints = (load(K_COMPLAINTS) || []).filter(c => c.createdBy === user.id);
  const q = qs('#user-search').value.trim().toLowerCase();
  const filtered = complaints.filter(c => {
    if (!q) return true;
    return (c.title + c.category + c.location + c.desc).toLowerCase().includes(q);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="small">No complaints yet.</div>';
    return;
  }
  filtered.forEach(c => list.appendChild(complaintCard(c, 'user')));
}

/* complaint card generator */
function complaintCard(c, ctx = 'user') {
  const card = document.createElement('div');
  card.className = 'card-complaint';
  const left = document.createElement('div');
  left.className = 'left';
  const title = document.createElement('div');
  title.innerHTML = `<strong>${c.title}</strong>`;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `Category: ${c.category} • Location: ${c.location} • Reported: ${formatDateTime(c.createdAt)} • Incident: ${c.incidentDate}`;
  left.appendChild(title);
  left.appendChild(meta);

  const right = document.createElement('div');
  const status = document.createElement('div');
  status.className = `status-pill ${c.status==='Pending'?'status-pending':c.status==='In Progress'?'status-inprogress':'status-resolved'}`;
  status.textContent = c.status;
  right.appendChild(status);

  const btnRow = document.createElement('div');
  btnRow.style.marginTop = '8px';

  const details = document.createElement('button');
  details.textContent = 'Details';
  details.onclick = () => showDetailsModal(c);
  btnRow.appendChild(details);

  if (ctx === 'user') {
    if (c.status !== 'Resolved') {
      const upd = document.createElement('button');
      upd.textContent = 'Update / Close';
      upd.onclick = () => openUserUpdate(c.id);
      btnRow.appendChild(upd);
    }
  } else if (ctx === 'admin') {
    const assignBtn = document.createElement('button');
    assignBtn.textContent = 'Assign';
    assignBtn.onclick = () => openAssignModal(c.id);
    btnRow.appendChild(assignBtn);

    const changeBtn = document.createElement('button');
    changeBtn.textContent = 'Change Status';
    changeBtn.onclick = () => openStatusModal(c.id);
    btnRow.appendChild(changeBtn);
  } else if (ctx === 'staff') {
    if (c.status === 'Pending') {
      const start = document.createElement('button');
      start.textContent = 'Start (In Progress)';
      start.onclick = () => staffChangeStatus(c.id, 'In Progress');
      btnRow.appendChild(start);
    }
    if (c.status !== 'Resolved') {
      const resolve = document.createElement('button');
      resolve.textContent = 'Resolve';
      resolve.onclick = () => staffChangeStatus(c.id, 'Resolved');
      btnRow.appendChild(resolve);
    }
  }

  right.appendChild(btnRow);
  card.appendChild(left);
  card.appendChild(right);
  return card;
}

/* show details modal */
function showDetailsModal(c) {
  const body = qs('#modal-body');
  body.innerHTML = `<h3>${c.title}</h3>
    <p><strong>Category:</strong> ${c.category} • <strong>Location:</strong> ${c.location}</p>
    <p><strong>Description:</strong><br/>${c.desc.replace(/\n/g, '<br/>')}</p>
    <p class="small"><strong>Reported by:</strong> ${c.createdByName} • ${formatDateTime(c.createdAt)}</p>
    <p class="small"><strong>Status:</strong> ${c.status} ${c.assignedToName? ' • Assigned to: ' + c.assignedToName : ''}</p>
    <h4>History & Remarks</h4>
    <div>${c.history.map(h=>`<div class="small">[${formatDateTime(h.at)}] ${h.status}${h.note? ' — '+h.note: ''}</div>`).join('')}</div>
    <div>${c.remarks.map(r=>`<div class="small">[${formatDateTime(r.at)}] ${r.byName}: ${r.text}</div>`).join('')}</div>`;
  openModal();
}

/* modal helpers */
function openModal() {
  qs('#modal').classList.remove('hidden');
}
function closeModal() {
  qs('#modal').classList.add('hidden');
  qs('#modal-body').innerHTML = '';
  refreshAll(); // To update the lists after closing modal
}

/* open user update modal */
function openUserUpdate(cid) {
  const complaints = load(K_COMPLAINTS) || [];
  const c = complaints.find(x => x.id === cid);
  if (!c) return alert('Not found');
  const body = qs('#modal-body');
  body.innerHTML = `
    <h3>Update Complaint</h3>
    <div><strong>${c.title}</strong></div>
    <textarea id="upd-remark" placeholder="Add a remark (optional)"></textarea>
    <div style="margin-top:8px">
      <button id="btn-close-complaint">Close Complaint</button>
      <button id="btn-add-remark">Add Remark</button>
    </div>
    <div id="upd-msg" class="msg"></div>
  `;
  openModal();
  qs('#btn-add-remark').onclick = () => {
    const text = qs('#upd-remark').value.trim();
    if (!text) {
      qs('#upd-msg').textContent = 'Enter remark first';
      return;
    }
    c.remarks.push({
      at: new Date().toISOString(),
      text,
      by: getCurrent().id,
      byName: getCurrent().name
    });
    save(K_COMPLAINTS, complaints);
    qs('#upd-msg').style.color = 'green';
    qs('#upd-msg').textContent = 'Remark added';
    refreshCurrentView();
  };
  qs('#btn-close-complaint').onclick = () => {
    if (c.status === 'Resolved') {
      qs('#upd-msg').textContent = 'Already resolved';
      return;
    }
    c.status = 'Resolved';
    c.history.push({
      status: 'Resolved',
      by: getCurrent().id,
      at: new Date().toISOString(),
      note: 'Closed by user'
    });
    save(K_COMPLAINTS, complaints);
    qs('#upd-msg').style.color = 'green';
    qs('#upd-msg').textContent = 'Complaint closed';
    refreshCurrentView();
  };
}

/* ---------- Admin functions ---------- */
function renderAdminComplaints() {
  const list = qs('#admin-complaints-list');
  list.innerHTML = '';
  const complaints = load(K_COMPLAINTS) || [];
  const statusFilter = qs('#filter-status').value;
  const category = qs('#filter-category').value.trim().toLowerCase();
  const from = qs('#filter-from').value;
  const to = qs('#filter-to').value;

  let filtered = complaints.slice();
  if (statusFilter) filtered = filtered.filter(c => c.status === statusFilter);
  if (category) filtered = filtered.filter(c => c.category.toLowerCase().includes(category));
  if (from) filtered = filtered.filter(c => new Date(c.createdAt) >= new Date(from));
  if (to) filtered = filtered.filter(c => new Date(c.createdAt) <= new Date(to + 'T23:59:59'));

  if (!filtered.length) {
    list.innerHTML = '<div class="small">No complaints for selected filters.</div>';
    return;
  }
  filtered.forEach(c => list.appendChild(complaintCard(c, 'admin')));
}

/* manage staff list */
function addStaff() {
  const name = qs('#staff-name').value.trim();
  const email = qs('#staff-email').value.trim().toLowerCase();
  const pwd = qs('#staff-password').value;
  const msg = qs('#add-staff-msg'); // Corrected message element ID

  if (!name || !email || !pwd) {
    msg.textContent = 'Enter staff details';
    msg.style.color = 'red';
    return;
  }

  const users = load(K_USERS) || [];
  if (users.find(u => u.email === email)) {
    msg.textContent = 'Email already exists';
    msg.style.color = 'red';
    return;
  }

  const staff = {
    id: uid('u'),
    name,
    email,
    password: pwd,
    role: 'staff'
  };
  users.push(staff);
  save(K_USERS, users);
  qs('#staff-name').value = '';
  qs('#staff-email').value = '';
  qs('#staff-password').value = '';
  msg.textContent = 'Staff added successfully';
  msg.style.color = 'green';
  renderStaffList();
}

/* render staff list */
function renderStaffList() {
  const div = qs('#staff-list');
  div.innerHTML = '';
  const users = load(K_USERS) || [];
  const staff = users.filter(u => u.role === 'staff');
  if (!staff.length) {
    div.innerHTML = '<div class="small">No staff found</div>';
    return;
  }
  staff.forEach(s => {
    const el = document.createElement('div');
    el.className = 'card-complaint';
    el.innerHTML = `<div class="left"><strong>${s.name}</strong><div class="small">${s.email}</div></div>`;
    const right = document.createElement('div');
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.onclick = () => {
      if (!confirm('Remove staff account?')) return;
      const users = load(K_USERS) || [];
      const idx = users.findIndex(u => u.id === s.id);
      if (idx >= 0) {
        users.splice(idx, 1);
        save(K_USERS, users);
        renderStaffList();
      }
    };
    right.appendChild(del);
    el.appendChild(right);
    div.appendChild(el);
  });
}

/* open assign modal */
function openAssignModal(cid) {
  const complaints = load(K_COMPLAINTS) || [];
  const c = complaints.find(x => x.id === cid);
  if (!c) return alert('Not found');
  const users = load(K_USERS) || [];
  const staff = users.filter(u => u.role === 'staff');

  const body = qs('#modal-body');
  body.innerHTML = `<h3>Assign Complaint</h3>
    <div><strong>${c.title}</strong></div>
    <select id="assign-select"><option value="">-- select staff --</option>${staff.map(s=>`<option value="${s.id}">${s.name} (${s.email})</option>`).join('')}</select>
    <textarea id="assign-note" placeholder="Note to staff (optional)"></textarea>
    <div style="margin-top:8px"><button id="btn-assign-do">Assign</button></div>
    <div id="assign-msg" class="msg"></div>`;

  openModal();
  qs('#btn-assign-do').onclick = () => {
    const sid = qs('#assign-select').value;
    const note = qs('#assign-note').value.trim();
    const s = staff.find(x => x.id === sid);

    if (!sid) {
      qs('#assign-msg').textContent = 'Select staff to assign';
      return;
    }

    c.assignedTo = s.id;
    c.assignedToName = s.name;
    c.history.push({
      status: 'Assigned',
      by: getCurrent().id,
      at: new Date().toISOString(),
      note: note || `Assigned to ${s.name}`
    });
    save(K_COMPLAINTS, complaints);
    qs('#assign-msg').style.color = 'green';
    qs('#assign-msg').textContent = 'Assigned';
    refreshCurrentView();
  };
}

/* open change status modal */
function openStatusModal(cid) {
  const complaints = load(K_COMPLAINTS) || [];
  const c = complaints.find(x => x.id === cid);
  if (!c) return;
  const body = qs('#modal-body');
  body.innerHTML = `<h3>Change Status</h3>
    <div><strong>${c.title}</strong></div>
    <select id="status-select">
      <option value="Pending">Pending</option>
      <option value="In Progress">In Progress</option>
      <option value="Resolved">Resolved</option>
    </select>
    <textarea id="status-note" placeholder="Note (optional)"></textarea>
    <div style="margin-top:8px"><button id="btn-status-do">Update</button></div>
    <div id="status-msg" class="msg"></div>`;
  qs('#status-select').value = c.status;
  openModal();
  qs('#btn-status-do').onclick = () => {
    const st = qs('#status-select').value;
    const note = qs('#status-note').value.trim();
    if (st === c.status) {
      qs('#status-msg').textContent = 'Status unchanged';
      return;
    }
    c.status = st;
    c.history.push({
      status: st,
      by: getCurrent().id,
      at: new Date().toISOString(),
      note: note || ''
    });
    save(K_COMPLAINTS, complaints);
    qs('#status-msg').style.color = 'green';
    qs('#status-msg').textContent = 'Status updated';
    refreshCurrentView();
  };
}

/* ---------- Staff functions ---------- */
function renderStaffComplaints() {
  const list = qs('#staff-complaints-list');
  list.innerHTML = '';
  const cur = getCurrent();
  if (!cur) return;
  const complaints = (load(K_COMPLAINTS) || []).filter(c => c.assignedTo === cur.id);
  if (!complaints.length) {
    list.innerHTML = '<div class="small">No assigned complaints</div>';
    return;
  }
  complaints.forEach(c => list.appendChild(complaintCard(c, 'staff')));
}

function staffChangeStatus(cid, newStatus) {
  const complaints = load(K_COMPLAINTS) || [];
  const c = complaints.find(x => x.id === cid);
  if (!c) return;
  const cur = getCurrent();
  if (cur.role !== 'staff') {
    alert('Only staff can perform this action');
    return;
  }
  c.status = newStatus;
  c.history.push({
    status: newStatus,
    by: cur.id,
    at: new Date().toISOString(),
    note: `Updated by ${cur.name}`
  });
  save(K_COMPLAINTS, complaints);
  refreshAll();
}

/* ---------- Analytics ---------- */
function renderAnalytics() {
  const complaints = load(K_COMPLAINTS) || [];
  if (qs('#stat-total')) qs('#stat-total').textContent = complaints.length;
  if (qs('#stat-pending')) qs('#stat-pending').textContent = complaints.filter(c => c.status === 'Pending').length;
  if (qs('#stat-inprogress')) qs('#stat-inprogress').textContent = complaints.filter(c => c.status === 'In Progress').length;
  if (qs('#stat-resolved')) qs('#stat-resolved').textContent = complaints.filter(c => c.status === 'Resolved').length;

  const breakdown = {};
  complaints.forEach(c => {
    const cat = c.category || 'Unspecified';
    breakdown[cat] = (breakdown[cat] || 0) + 1;
  });
  const el = qs('#category-breakdown');
  if (el) {
    el.innerHTML = '';
    if (!Object.keys(breakdown).length) {
      el.innerHTML = '<div class="small">No data</div>';
      return;
    }
    Object.entries(breakdown).forEach(([k, v]) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.minWidth = '120px';
      card.innerHTML = `<strong>${v}</strong><div class="small">${k}</div>`;
      el.appendChild(card);
    });
  }
}

/* ---------- Helpers & refresh ---------- */
function refreshCurrentView() {
  const cur = getCurrent();
  if (!cur) {
    showView('login');
    return;
  }
  routeToRoleView(cur.role);
}

function refreshAll() {
  renderUserComplaints();
  renderAdminComplaints();
  renderStaffComplaints();
  renderAnalytics();
  renderStaffList();
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  // expose some debugging helpers (optional)
  window.CMP = {
    users: () => load(K_USERS),
    complaints: () => load(K_COMPLAINTS),
    current: () => load(K_CURRENT)
  };
});