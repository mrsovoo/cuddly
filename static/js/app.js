	        // ===== CONFIG =====
	        const API = window.location.protocol === 'file:'
	            ? 'http://127.0.0.1:8001/api'
	            : `${window.location.origin}/api`;
	        let currentUser = null;
        let userRole = null;
        let hrId = null;
        let charts = {};
        let selectedEmployeeId = null;
	        let selectedEmployeeName = '';
	        let currentReportId = null;

	        async function apiFetch(path, options = {}) {
	            const res = await fetch(`${API}${path}`, options);
	            const contentType = res.headers.get('content-type') || '';
	            const data = contentType.includes('application/json') ? await res.json() : await res.text();
	            if (!res.ok) {
	                const detail = typeof data === 'object' ? data.detail : data;
	                throw new Error(detail || 'Server bilan aloqa xatosi');
	            }
	            return data;
	        }

	        function jsonOptions(data, headers = {}) {
	            return {
	                method: 'POST',
	                headers: { ...headers, 'Content-Type': 'application/json' },
	                body: JSON.stringify(data)
	            };
	        }

	        function patchJsonOptions(data, headers = {}) {
	            return {
	                method: 'PATCH',
	                headers: { ...headers, 'Content-Type': 'application/json' },
	                body: JSON.stringify(data)
	            };
	        }

	        function escapeHtml(value) {
	            return String(value ?? '').replace(/[&<>"']/g, (char) => ({
	                '&': '&amp;',
	                '<': '&lt;',
	                '>': '&gt;',
	                '"': '&quot;',
	                "'": '&#039;'
	            }[char]));
	        }

        // ===== TIME =====
        function updateTime() {
            const now = new Date();
            document.getElementById('currentTime').textContent = now.toLocaleString('uz-UZ', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
        updateTime();
        setInterval(updateTime, 1000);

        document.getElementById('attendanceDate').textContent = new Date().toLocaleDateString('uz-UZ', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // ===== LOGIN =====
        async function handleLogin(e) {
            e.preventDefault();
            const login = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            
            if (!login || !password) {
                showNotification('Iltimos, login va parolni kiriting!', 'error');
                return;
            }

	            // ADMIN LOGIN
	            if (login === 'sohibjon') {
	                try {
	                    const data = await apiFetch('/yourhr/auth/login', jsonOptions({ username: login, password }));
	                    userRole = 'admin';
	                    currentUser = data.user;
	                    document.getElementById('loginPage').style.display = 'none';
	                    document.getElementById('mainApp').style.display = 'block';
	                    document.getElementById('panelBadge').textContent = 'Admin';
	                    document.getElementById('userName').textContent = currentUser.full_name;
	                    document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();
	                    document.getElementById('userRole').textContent = 'Super Admin';
	                    document.getElementById('adminNav').style.display = 'block';
	                    document.getElementById('hrNav').style.display = 'none';
	                    document.getElementById('loginSubtitle').textContent = 'Admin Panel';
	                    document.getElementById('panelTypeDisplay').className = 'panel-type admin';
	                    document.getElementById('panelTypeDisplay').innerHTML = '<i class="fas fa-user-shield"></i> Admin Panel';
	                    loadAll();
	                    showNotification('Xush kelibsiz, ' + currentUser.full_name + '!', 'success');
	                    return;
	                } catch (err) {
	                    showNotification(err.message || 'Login yoki parol xato!', 'error');
	                    return;
	                }
	            }

            // HR LOGIN
            try {
	                const data = await apiFetch('/hr/auth/login', jsonOptions({ username: login, password }));
                
                userRole = 'hr';
                currentUser = data.user;
                hrId = currentUser.id;
                
                document.getElementById('loginPage').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                document.getElementById('panelBadge').textContent = 'HR';
                document.getElementById('userName').textContent = currentUser.full_name;
                document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();
                document.getElementById('userRole').textContent = currentUser.company_name || 'Kompaniya HR';
                document.getElementById('adminNav').style.display = 'none';
                document.getElementById('hrNav').style.display = 'block';
                document.getElementById('loginSubtitle').textContent = 'HR Panel';
                document.getElementById('panelTypeDisplay').className = 'panel-type hr';
                document.getElementById('panelTypeDisplay').innerHTML = '<i class="fas fa-user-tie"></i> HR Panel';
                document.getElementById('infoCompany').textContent = currentUser.company_name || '-';
                document.getElementById('infoHr').textContent = currentUser.full_name || '-';
	                document.getElementById('supportHeaderTitle').textContent = '📌 Support — ' + (currentUser.company_name || 'Kompaniya');
                
                loadAll();
                showNotification('Xush kelibsiz, ' + currentUser.full_name + '!', 'success');
                
            } catch (err) {
                showNotification(err.message || 'Login yoki parol xato!', 'error');
            }
        }

        function logout() {
            if (!confirm('Chiqishni xohlaysizmi?')) return;
            document.getElementById('loginPage').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
            userRole = null;
            currentUser = null;
            hrId = null;
            document.getElementById('adminNav').style.display = 'block';
            document.getElementById('hrNav').style.display = 'none';
        }

        // ===== SIDEBAR =====
        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('overlay').classList.toggle('active');
        }

        // ===== TABS =====
        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
            document.querySelectorAll('.sidebar-nav .item').forEach(el => el.classList.remove('active'));
            document.querySelector(`.sidebar-nav .item[data-tab="${tab}"]`)?.classList.add('active');

            const titles = {
                dashboard: '📊 Dashboard',
                companies: '🏢 Kompaniyalar',
                hrs: '👔 HR\'lar',
                employees: '👥 Xodimlar',
                tasks: '📋 Vazifalar',
                attendance: '⏰ Davomat',
                reports: '📝 Kunlik hisobotlar',
                financial: '💰 Moliyaviy holat',
                analytics: '📈 Analitika',
                support: '🛠 Support',
                chat: '💬 Chat',
                rules: '⚖️ Qoidalar'
            };
            document.getElementById('pageTitle').textContent = titles[tab] || tab;

            if (userRole === 'admin') {
                if (tab === 'dashboard') loadDashboard();
                if (tab === 'companies') loadCompanies();
                if (tab === 'hrs') loadHrs();
                if (tab === 'support') loadSupport();
            } else {
                if (tab === 'dashboard') loadDashboard();
                if (tab === 'employees') loadEmployees();
                if (tab === 'tasks') loadTasks();
                if (tab === 'attendance') loadAttendance();
                if (tab === 'reports') loadReports();
                if (tab === 'financial') loadFinancial();
                if (tab === 'analytics') loadAnalytics();
                if (tab === 'support') loadSupport();
                if (tab === 'chat') loadChatEmployees();
                if (tab === 'rules') loadRules();
            }
        }

        // ===== NOTIFICATIONS =====
        function showNotification(message, type = 'info') {
            const container = document.getElementById('notifContainer');
            const notif = document.createElement('div');
            notif.className = `notif notif-${type}`;
            notif.innerHTML = `<span>${message}</span><button class="close" onclick="this.parentElement.remove()">&times;</button>`;
            container.appendChild(notif);
            setTimeout(() => notif.remove(), 4000);
        }

        // ===== MODALS =====
        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
        }
        document.querySelectorAll('.modal').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target === el) el.classList.remove('active');
            });
        });

        // =============================================
        // ===== ADMIN FUNCTIONS =====
        // =============================================

        async function loadDashboard() {
            try {
                if (userRole === 'admin') {
                    const res = await fetch(`${API}/yourhr/dashboard/stats`);
                    const data = await res.json();
                    document.getElementById('statCompanies').textContent = data.companies || 0;
                    document.getElementById('statHrs').textContent = data.hrs || 0;
                    document.getElementById('statEmployees').textContent = data.employees || 0;
                    document.getElementById('statSupport').textContent = data.support || 0;
                    document.getElementById('companyCount').textContent = data.companies || 0;
                    document.getElementById('hrCount').textContent = data.hrs || 0;
                    document.getElementById('supportCount').textContent = data.support || 0;
                    updateAdminCharts();
                } else {
                    const res = await fetch(`${API}/hr/dashboard/stats`, { headers: { 'hr-id': hrId } });
                    const data = await res.json();
                    document.getElementById('statEmployees').textContent = data.employees || 0;
                    document.getElementById('statTasks').textContent = data.tasks || 0;
                    document.getElementById('statAttendance').textContent = data.attendance_today || 0;
                    document.getElementById('statReports').textContent = data.reports || 0;
                    document.getElementById('empCount').textContent = data.employees || 0;
                    document.getElementById('taskCount').textContent = data.tasks || 0;
                    document.getElementById('supportCount').textContent = data.support || 0;
                    document.getElementById('reportCount').textContent = data.reports || 0;
                    document.getElementById('infoEmployees').textContent = data.employees || 0;
                    document.getElementById('infoKpi').textContent = data.avg_kpi || '0%';
                    updateHrCharts();
                }
            } catch (e) {
                console.error('Dashboard error:', e);
            }
        }

        function updateAdminCharts() {
            const ctx1 = document.getElementById('companiesChart');
            const ctx2 = document.getElementById('activityChart');
            if (ctx1) {
                if (charts.companies) charts.companies.destroy();
                charts.companies = new Chart(ctx1, {
                    type: 'bar',
                    data: { labels: ['Kompaniyalar'], datasets: [{ label: 'Xodimlar', data: [0], backgroundColor: ['#4f46e5'], borderRadius: 8 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }
                });
            }
            if (ctx2) {
                if (charts.activity) charts.activity.destroy();
                charts.activity = new Chart(ctx2, {
                    type: 'line',
                    data: { labels: ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum'], datasets: [{ label: 'Faoliyat', data: [0, 0, 0, 0, 0], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }
                });
            }
        }

        function updateHrCharts() {
            fetch(`${API}/hr/employees`, { headers: { 'hr-id': hrId } }).then(r => r.json()).then(employees => {
                const names = employees.map(e => e.full_name);
                const kpis = employees.map(e => e.kpi_target || 100);
                const ctx1 = document.getElementById('companiesChart');
                const ctx2 = document.getElementById('activityChart');
                if (ctx1) {
                    if (charts.kpi) charts.kpi.destroy();
                    charts.kpi = new Chart(ctx1, {
                        type: 'bar',
                        data: { labels: names.length ? names : ['Ma\'lumot yo\'q'], datasets: [{ label: 'KPI %', data: names.length ? kpis : [0], backgroundColor: ['#4f46e5', '#6366f1', '#818cf8', '#a78bfa', '#c4b5fd'], borderRadius: 8 }] },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }
                    });
                }
                if (ctx2) {
                    if (charts.attendance) charts.attendance.destroy();
                    charts.attendance = new Chart(ctx2, {
                        type: 'line',
                        data: { labels: names.length ? names : ['Ma\'lumot yo\'q'], datasets: [{ label: 'Davomat %', data: names.length ? kpis.map(() => Math.floor(Math.random() * 30) + 70) : [0], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }] },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }
                    });
                }
            });
        }

        // ===== ADMIN: KOMPANIYALAR =====
        async function loadCompanies() {
            try {
                const res = await fetch(`${API}/yourhr/companies`);
                const companies = await res.json();
                renderCompanies(companies);
            } catch (e) {}
        }

        function renderCompanies(companies) {
            const tbody = document.getElementById('companiesTable');
            document.getElementById('companyTotal').textContent = companies.length;
            if (!companies || companies.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="7" class="empty-state"><i class="fas fa-building"></i> Kompaniyalar mavjud emas</td></tr>`;
                return;
            }
            tbody.innerHTML = companies.map((c, i) => `
                    <tr data-name="${escapeHtml(c.name).toLowerCase()}">
                        <td>${i+1}</td>
                        <td><strong>${escapeHtml(c.name)}</strong></td>
                        <td>${escapeHtml(c.tin)}</td>
                        <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">${escapeHtml(c.hr_login || '-')}</code></td>
                        <td>${c.employee_count || 0}</td>
                        <td><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'Faol' : 'Faol emas'}</span></td>
                        <td>
                            <button onclick="editCompany(${c.id})" class="btn-icon"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteCompany(${c.id})" class="btn-icon danger"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('');
            loadFilters();
        }

        function filterCompanies() {
            const q = document.getElementById('companySearch').value.toLowerCase();
            document.querySelectorAll('#companiesTable tr[data-name]').forEach(row => {
                row.style.display = row.dataset.name.includes(q) ? '' : 'none';
            });
        }

        function showCompanyModal(data) {
            document.getElementById('companyModalTitle').textContent = data ? 'Kompaniyani tahrirlash' : 'Yangi Kompaniya';
            document.getElementById('companyId').value = data?.id || '';
            document.getElementById('compName').value = data?.name || '';
            document.getElementById('compTin').value = data?.tin || '';
            document.getElementById('compAddress').value = data?.address || '';
            document.getElementById('compPhone').value = data?.phone || '';
            document.getElementById('compEmail').value = data?.email || '';
            document.getElementById('companyModal').classList.add('active');
        }

        async function saveCompany(e) {
            e.preventDefault();
            const id = document.getElementById('companyId').value;
            const data = {
                name: document.getElementById('compName').value,
                tin: document.getElementById('compTin').value,
                address: document.getElementById('compAddress').value || '',
                phone: document.getElementById('compPhone').value || '',
                email: document.getElementById('compEmail').value || ''
            };
    
            try {
                const url = id ? `${API}/yourhr/companies/${id}` : `${API}/yourhr/companies`;
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
        
                const result = await res.json();
                if (!res.ok) throw new Error(result.detail || 'Xatolik yuz berdi');
        
                if (!id) {
                    showNotification(`✅ Kompaniya qo'shildi!\nHR Login: ${result.hr.login}\nHR Parol: ${result.hr.password}`, 'success');
                } else {
                    showNotification('✅ Kompaniya yangilandi!', 'success');
                }
                closeModal('companyModal');
                loadCompanies();
                loadDashboard();
                loadHrs();
            } catch (err) {
                showNotification('❌ ' + err.message, 'error');
            }
        }

        async function editCompany(id) {
            try {
                const res = await fetch(`${API}/yourhr/companies`);
                const companies = await res.json();
                const c = companies.find(x => x.id === id);
                if (c) showCompanyModal(c);
            } catch (e) {}
        }

        async function deleteCompany(id) {
            if (!confirm('Kompaniyani o\'chirmoqchimisiz?')) return;
            try {
                await fetch(`${API}/yourhr/companies/${id}`, { method: 'DELETE' });
                showNotification('Kompaniya o\'chirildi', 'success');
                loadCompanies();
                loadDashboard();
                loadHrs();
            } catch (e) {}
        }

        // ===== ADMIN: HR'LAR =====
        async function loadHrs() {
            try {
                const companyId = document.getElementById('hrCompanyFilter').value;
                let url = `${API}/yourhr/company-hr`;
                if (companyId) url += `/${companyId}`;
                const res = await fetch(url);
                const hrs = await res.json();
                renderHrs(hrs);
            } catch (e) {}
        }

        function renderHrs(hrs) {
            const tbody = document.getElementById('hrsTable');
            document.getElementById('hrTotal').textContent = hrs.length;
            if (!hrs || hrs.length === 0) {
                tbody.innerHTML =
                `<tr><td colspan="6" class="empty-state"><i class="fas fa-user-tie"></i> HR'lar mavjud emas</td></tr>`;
                return;
            }
            fetch(`${API}/yourhr/companies`).then(r => r.json()).then(companies => {
                const compMap = {};
                companies.forEach(c => compMap[c.id] = c.name);
                tbody.innerHTML = hrs.map((h, i) => `
                        <tr>
                            <td>${i+1}</td>
                            <td><strong>${escapeHtml(h.full_name)}</strong></td>
                            <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">${escapeHtml(h.login)}</code></td>
                            <td>${escapeHtml(compMap[h.company_id] || '-')}</td>
                            <td><span class="badge ${h.is_active ? 'badge-success' : 'badge-danger'}">${h.is_active ? 'Faol' : 'Faol emas'}</span></td>
                            <td>
                                <button onclick="resetHrPassword(${h.id})" class="btn-icon" title="Parol tiklash"><i class="fas fa-key"></i></button>
                            </td>
                        </tr>
                    `).join('');
            });
        }

	        async function resetHrPassword(id) {
	            const newPass = prompt('Yangi parolni kiriting:');
	            if (!newPass) return;
	            try {
	                await apiFetch(`/yourhr/company-hr/${id}/password`, patchJsonOptions({ new_password: newPass }));
	                showNotification('✅ Parol yangilandi!', 'success');
	                loadHrs();
	            } catch (e) { showNotification('❌ ' + e.message, 'error'); }
	        }

        async function loadFilters() {
            try {
                const res = await fetch(`${API}/yourhr/companies`);
                const companies = await res.json();
                document.getElementById('hrCompanyFilter').innerHTML =
                    `<option value="">Barcha kompaniyalar</option>` +
                    companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
            } catch (e) {}
        }

        // =============================================
        // ===== HR FUNCTIONS =====
        // =============================================

        async function loadEmployees() {
            try {
                const res = await fetch(`${API}/hr/employees`, { headers: { 'hr-id': hrId } });
                const employees = await res.json();
                renderEmployees(employees);
                loadChatEmployees();
            } catch (e) {}
        }

        function renderEmployees(employees) {
            const tbody = document.getElementById('employeesTable');
            document.getElementById('empTotal').textContent = employees.length;
            if (!employees || employees.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="9" class="empty-state"><i class="fas fa-users"></i> Xodimlar mavjud emas</td></tr>`;
                return;
            }
            tbody.innerHTML = employees.map((e, i) => `
                    <tr data-name="${escapeHtml(e.full_name).toLowerCase()}">
                        <td>${i+1}</td>
                        <td><strong>${escapeHtml(e.full_name)}</strong></td>
                        <td>${escapeHtml(e.position || '-')}</td>
                        <td>${escapeHtml(e.work_start || '09:00')} - ${escapeHtml(e.work_end || '18:00')}</td>
                        <td>${e.salary ? Number(e.salary).toLocaleString() + ' so\'m' : '-'}</td>
                        <td><span class="badge ${e.kpi_target >= 80 ? 'badge-success' : 'badge-warning'}">${e.kpi_target || 100}%</span></td>
                        <td>${escapeHtml(e.telegram_id || '-')}</td>
                        <td><span class="badge ${e.is_active ? 'badge-success' : 'badge-danger'}">${e.is_active ? 'Faol' : 'Faol emas'}</span></td>
                        <td>
                            <button onclick="deleteEmployee(${e.id})" class="btn-icon danger"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('');
        }

        function filterEmployees() {
            const q = document.getElementById('employeeSearch').value.toLowerCase();
            document.querySelectorAll('#employeesTable tr[data-name]').forEach(row => {
                row.style.display = row.dataset.name.includes(q) ? '' : 'none';
            });
        }

        function showEmployeeModal() {
            document.getElementById('employeeForm').reset();
            document.getElementById('empSalary').value = '5000000';
            document.getElementById('empKpi').value = '100';
            document.getElementById('empWorkStart').value = '09:00';
            document.getElementById('empWorkEnd').value = '18:00';
            document.getElementById('employeeModal').classList.add('active');
        }

	        async function saveEmployee(e) {
	            e.preventDefault();
	            const data = {
	                full_name: document.getElementById('empName').value.trim(),
	                position: document.getElementById('empPosition').value.trim() || null,
	                salary: Number(document.getElementById('empSalary').value || 0),
	                kpi_target: Number(document.getElementById('empKpi').value || 100),
	                work_start: document.getElementById('empWorkStart').value || '09:00',
	                work_end: document.getElementById('empWorkEnd').value || '18:00',
	                telegram_id: document.getElementById('empTelegramLogin').value.trim() || null,
	                telegram_password: document.getElementById('empTelegramPass').value || null
	            };
	            try {
	                await apiFetch('/hr/employees', jsonOptions(data, { 'hr-id': hrId }));
	                closeModal('employeeModal');
	                showNotification('✅ Xodim qo\'shildi!', 'success');
	                loadEmployees();
	                loadDashboard();
            } catch (err) { showNotification('❌ ' + err.message, 'error'); }
        }

        async function deleteEmployee(id) {
            if (!confirm('Xodimni o\'chirmoqchimisiz?')) return;
            try {
                await fetch(`${API}/hr/employees/${id}`, { method: 'DELETE', headers: { 'hr-id': hrId } });
                showNotification('Xodim o\'chirildi', 'success');
                loadEmployees();
                loadDashboard();
            } catch (e) {}
        }

        // ===== HR: VAZIFALAR =====
        async function loadTasks() {
            try {
                const res = await fetch(`${API}/hr/tasks`, { headers: { 'hr-id': hrId } });
                const tasks = await res.json();
                renderTasks(tasks);
            } catch (e) {}
        }

        function renderTasks(tasks) {
            const tbody = document.getElementById('tasksTable');
            const filter = document.getElementById('taskFilter').value;
            const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
            if (!filtered || filtered.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="7" class="empty-state"><i class="fas fa-tasks"></i> Vazifalar mavjud emas</td></tr>`;
                return;
            }
            tbody.innerHTML = filtered.map((t, i) => `
                    <tr>
                        <td>${i+1}</td>
                        <td><strong>${escapeHtml(t.title)}</strong><br><small style="color:#94a3b8;">${escapeHtml(t.description || '')}</small></td>
                        <td>${escapeHtml(t.employee_name || '-')}</td>
                        <td><span class="badge ${t.status === 'completed' ? 'badge-success' : t.status === 'approved' ? 'badge-info' : t.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(t.status || 'pending')}</span></td>
                        <td>${t.bonus_amount ? Number(t.bonus_amount).toLocaleString() + ' so\'m' : '-'}</td>
                        <td>${t.deadline ? new Date(t.deadline).toLocaleDateString('uz-UZ') : '-'}</td>
                        <td>
                            ${t.status === 'pending' ? `
                                <button onclick="approveTask(${t.id})" class="btn btn-success btn-sm"><i class="fas fa-check"></i></button>
                                <button onclick="rejectTask(${t.id})" class="btn btn-danger btn-sm"><i class="fas fa-times"></i></button>
                            ` : t.status === 'approved' ? `
                                <button onclick="completeTask(${t.id})" class="btn btn-primary btn-sm"><i class="fas fa-check-double"></i> Bajarildi</button>
                            ` : `<span style="color:#94a3b8;font-size:12px;">${t.status === 'completed' ? '✅ Tamom' : '❌ Bekor'}</span>`}
                        </td>
                    </tr>
                `).join('');
        }

        function showTaskModal() {
            loadEmployeeSelect('taskEmployee');
            document.getElementById('taskForm').reset();
            document.getElementById('taskModal').classList.add('active');
        }

	        async function saveTask(e) {
	            e.preventDefault();
	            const data = {
	                assigned_to: Number(document.getElementById('taskEmployee').value),
	                title: document.getElementById('taskTitle').value.trim(),
	                description: document.getElementById('taskDesc').value.trim() || null,
	                priority: document.getElementById('taskPriority').value,
	                deadline: document.getElementById('taskDeadline').value || null
	            };
	            try {
	                await apiFetch('/hr/tasks', jsonOptions(data, { 'hr-id': hrId }));
	                closeModal('taskModal');
	                showNotification('✅ Vazifa yaratildi!', 'success');
	                loadTasks();
                loadDashboard();
            } catch (err) { showNotification('❌ ' + err.message, 'error'); }
        }

        async function approveTask(id) {
            try {
                await fetch(`${API}/hr/tasks/${id}/approve`, { method: 'PATCH', headers: { 'hr-id': hrId } });
                showNotification('✅ Vazifa tasdiqlandi!', 'success');
                loadTasks();
            } catch (e) {}
        }

        async function rejectTask(id) {
            try {
                await fetch(`${API}/hr/tasks/${id}/reject`, { method: 'PATCH', headers: { 'hr-id': hrId } });
                showNotification('❌ Vazifa bekor qilindi', 'success');
                loadTasks();
            } catch (e) {}
        }

        async function completeTask(id) {
            try {
                await fetch(`${API}/hr/tasks/${id}/complete`, { method: 'PATCH', headers: { 'hr-id': hrId } });
                showNotification('✅ Vazifa bajarildi! Bonus hisoblandi.', 'success');
                loadTasks();
                loadDashboard();
            } catch (e) {}
        }

        function loadEmployeeSelect(selectId) {
            fetch(`${API}/hr/employees`, { headers: { 'hr-id': hrId } }).then(r => r.json()).then(employees => {
                document.getElementById(selectId).innerHTML = employees.map(e =>
                    `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`).join('');
            });
        }

        // ===== HR: DAVOMAT =====
        async function loadAttendance() {
            try {
                const res = await fetch(`${API}/hr/attendance/today`, { headers: { 'hr-id': hrId } });
                const data = await res.json();
                renderAttendance(data);
            } catch (e) {}
        }

        function renderAttendance(data) {
            const tbody = document.getElementById('attendanceTable');
            if (!data || data.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="8" class="empty-state"><i class="fas fa-clock"></i> Bugun davomat qayd etilmagan</td></tr>`;
                return;
            }
            const statusMap = {
                'pending': '<span class="badge badge-gray">⏳ Kutilmoqda</span>',
                'present': '<span class="badge badge-success">✅ Ishda</span>',
                'absent': '<span class="badge badge-danger">❌ Kelmagan</span>',
                'late': '<span class="badge badge-warning">⏰ Kech kelgan</span>',
                'completed': '<span class="badge badge-success">✅ Tamom</span>'
            };
            tbody.innerHTML = data.map((a, i) => `
                    <tr>
                        <td>${i+1}</td>
                        <td><strong>${escapeHtml(a.employee_name || '-')}</strong></td>
                        <td>${a.come_time ? new Date(a.come_time).toLocaleTimeString('uz-UZ', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                        <td>${a.leave_time ? new Date(a.leave_time).toLocaleTimeString('uz-UZ', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                        <td>${a.total_hours || '—'}</td>
                        <td>${a.is_late ? a.late_minutes + ' daqiqa' : '—'}</td>
                        <td class="${a.fine_amount > 0 ? 'text-danger' : ''}">${a.fine_amount ? Number(a.fine_amount).toLocaleString() + ' so\'m' : '—'}</td>
                        <td>${statusMap[a.status] || escapeHtml(a.status)}</td>
                    </tr>
                `).join('');
        }

        // ===== HR: KUNLIK HISOBOTLAR =====
        async function loadReports() {
            try {
                const filter = document.getElementById('reportFilter').value;
                let url = `${API}/hr/reports/daily`;
                if (filter !== 'all') url += `?status=${filter}`;
                const res = await fetch(url, { headers: { 'hr-id': hrId } });
                const reports = await res.json();
                renderReports(reports);
            } catch (e) {}
        }

        function renderReports(reports) {
            const tbody = document.getElementById('reportsTable');
            if (!reports || reports.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="6" class="empty-state"><i class="fas fa-file-alt"></i> Hisobotlar mavjud emas</td></tr>`;
                return;
            }
            tbody.innerHTML = reports.map((r, i) => `
                    <tr>
                        <td>${i+1}</td>
                        <td><strong>${escapeHtml(r.employee_name || '-')}</strong></td>
                        <td>${escapeHtml(r.report_text.substring(0, 100))}${r.report_text.length > 100 ? '...' : ''}</td>
                        <td>${new Date(r.date).toLocaleDateString('uz-UZ')}</td>
                        <td><span class="badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${r.status}</span></td>
                        <td>
                            <button onclick="viewReport(${r.id})" class="btn btn-primary btn-sm"><i class="fas fa-eye"></i> Ko'rish</button>
                            ${r.status === 'pending' ? `
                                <button onclick="approveReportAction(${r.id})" class="btn btn-success btn-sm"><i class="fas fa-check"></i></button>
                                <button onclick="rejectReportAction(${r.id})" class="btn btn-danger btn-sm"><i class="fas fa-times"></i></button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
        }

        function viewReport(id) {
            fetch(`${API}/hr/reports/daily`, { headers: { 'hr-id': hrId } }).then(r => r.json()).then(reports => {
                const r = reports.find(x => x.id === id);
                if (!r) return;
                currentReportId = id;
                document.getElementById('reportDetail').innerHTML = `
                        <div style="margin-bottom:16px;">
                            <p><strong>Xodim:</strong> ${escapeHtml(r.employee_name)}</p>
                            <p><strong>Sana:</strong> ${new Date(r.date).toLocaleString('uz-UZ')}</p>
                            <p><strong>Holat:</strong> <span class="badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${r.status}</span></p>
                            ${r.admin_comment ? `<p><strong>HR izohi:</strong> ${escapeHtml(r.admin_comment)}</p>` : ''}
                        </div>
                        <div style="background:#f8fafc;padding:16px;border-radius:10px;">
                            <p><strong>Hisobot:</strong></p>
                            <p style="white-space:pre-wrap;">${escapeHtml(r.report_text)}</p>
                        </div>
                    `;
                document.getElementById('reportModal').classList.add('active');
            });
        }

	        async function approveReportAction(id) {
	            if (!confirm('Bu hisobotni tasdiqlaysizmi?')) return;
	            try {
	                await apiFetch(`/hr/reports/daily/${id}`, patchJsonOptions({
	                    status: 'approved',
	                    admin_comment: 'Tasdiqlandi'
	                }, { 'hr-id': hrId }));
	                showNotification('✅ Hisobot tasdiqlandi!', 'success');
                loadReports();
                loadDashboard();
                closeModal('reportModal');
            } catch (e) {}
        }

	        async function rejectReportAction(id) {
	            const comment = prompt('Rad etish sababini yozing:');
	            if (comment === null) return;
	            try {
	                await apiFetch(`/hr/reports/daily/${id}`, patchJsonOptions({
	                    status: 'rejected',
	                    admin_comment: comment
	                }, { 'hr-id': hrId }));
	                showNotification('❌ Hisobot rad etildi', 'success');
                loadReports();
                loadDashboard();
                closeModal('reportModal');
            } catch (e) {}
        }

        function approveReport() {
            if (currentReportId) approveReportAction(currentReportId);
        }

        function rejectReport() {
            if (currentReportId) rejectReportAction(currentReportId);
        }

        // ===== HR: MOLIYAVIY HOLAT =====
        async function loadFinancial() {
            try {
                const res = await fetch(`${API}/hr/employees`, { headers: { 'hr-id': hrId } });
                const employees = await res.json();
                renderSalary(employees);
                renderPromotions(employees);
                calculateFinancials(employees);
            } catch (e) {}
        }

        function calculateFinancials(employees) {
            const totalSalary = employees.reduce((s, e) => s + e.salary, 0);
            const totalBonuses = employees.reduce((s, e) => s + (e.kpi_target >= 80 ? e.salary * 0.1 : 0), 0);
            const totalFines = employees.reduce((s, e) => s + (e.kpi_target < 60 ? 50000 : 0), 0);
            const income = totalSalary + totalBonuses + 10000000;
            const expense = totalSalary + totalBonuses;
            document.getElementById('financialIncome').textContent = income.toLocaleString() + ' so\'m';
            document.getElementById('financialExpense').textContent = expense.toLocaleString() + ' so\'m';
            document.getElementById('financialProfit').textContent = (income - expense).toLocaleString() + ' so\'m';
            document.getElementById('infoFines').textContent = totalFines.toLocaleString() + ' so\'m';
            document.getElementById('infoBonuses').textContent = totalBonuses.toLocaleString() + ' so\'m';
        }

        function renderSalary(employees) {
            const tbody = document.getElementById('salaryTable');
            if (!employees || employees.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="8" class="empty-state"><i class="fas fa-coins"></i> Ma'lumotlar mavjud emas</td></tr>`;
                return;
            }
            tbody.innerHTML = employees.map((e, i) => {
                const bonus = e.kpi_target >= 80 ? Math.round(e.salary * 0.1) : 0;
                const fine = e.kpi_target < 60 ? 50000 : 0;
                return `
                        <tr>
                            <td>${i+1}</td>
                            <td><strong>${escapeHtml(e.full_name)}</strong></td>
                            <td>${escapeHtml(e.position || '-')}</td>
                            <td>${Number(e.salary).toLocaleString()} so'm</td>
                            <td><span class="badge ${e.kpi_target >= 80 ? 'badge-success' : 'badge-warning'}">${e.kpi_target}%</span></td>
                            <td>${bonus.toLocaleString()} so'm</td>
                            <td class="text-danger">${fine > 0 ? fine.toLocaleString() + ' so\'m' : '-'}</td>
                            <td><strong>${(e.salary + bonus - fine).toLocaleString()} so'm</strong></td>
                        </tr>
                    `;
            }).join('');
        }

        function renderPromotions(employees) {
            const tbody = document.getElementById('promotionTable');
            if (!employees || employees.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="6" class="empty-state"><i class="fas fa-arrow-up"></i> Lavozim oshirish takliflari mavjud emas</td></tr>`;
                return;
            }
            const sorted = [...employees].sort((a, b) => (b.kpi_target || 0) - (a.kpi_target || 0));
            const promotions = sorted.filter(e => (e.kpi_target || 0) >= 85);
            if (!promotions || promotions.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="6" class="empty-state"><i class="fas fa-arrow-up"></i> Lavozim oshirish takliflari mavjud emas</td></tr>`;
                return;
            }
            const positions = ['Junior', 'Middle', 'Senior', 'Team Lead', 'Manager', 'Director'];
            tbody.innerHTML = promotions.map((e, i) => {
                const currentPos = e.position || 'Junior';
                const idx = positions.indexOf(currentPos);
                const newPos = idx < positions.length - 1 ? positions[idx + 1] : positions[idx];
                return `
                        <tr>
                            <td>${i+1}</td>
                            <td><strong>${escapeHtml(e.full_name)}</strong></td>
                            <td>${escapeHtml(currentPos)}</td>
                            <td><span class="badge badge-success">${escapeHtml(newPos)}</span></td>
                            <td><span class="badge badge-success">${e.kpi_target}%</span></td>
                            <td>Yuqori KPI va samaradorlik</td>
                        </tr>
                    `;
            }).join('');
        }

        // ===== HR: ANALITIKA =====
        async function loadAnalytics() {
            try {
                const res = await fetch(`${API}/hr/employees`, { headers: { 'hr-id': hrId } });
                const employees = await res.json();
                const total = employees.length;
                const avgKpi = total > 0 ? employees.reduce((s, e) => s + (e.kpi_target || 100), 0) / total : 0;
                const totalFines = employees.reduce((s, e) => s + (e.kpi_target < 60 ? 50000 : 0), 0);
                document.getElementById('analyticsKpi').textContent = Math.round(avgKpi) + '%';
                document.getElementById('analyticsEmployees').textContent = total;
                document.getElementById('analyticsAttendance').textContent = Math.floor(Math.random() * 30) + 70 + '%';
                document.getElementById('analyticsFines').textContent = totalFines.toLocaleString() + ' so\'m';

                const rankingBody = document.getElementById('rankingTable');
                const sorted = [...employees].sort((a, b) => (b.kpi_target || 0) - (a.kpi_target || 0));
                if (sorted.length === 0) {
                    rankingBody.innerHTML =
                        `<tr><td colspan="7" class="empty-state"><i class="fas fa-users"></i> Ma'lumotlar mavjud emas</td></tr>`;
                    return;
                }
                rankingBody.innerHTML = sorted.map((e, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
                    const fines = e.kpi_target < 60 ? 50000 : 0;
                    const rec = e.kpi_target >= 90 ? '🏆 A\'lo' : e.kpi_target >= 75 ? '✅ Yaxshi' : '📈 O\'rtacha';
                    return `
                            <tr>
                                <td>${i+1}</td>
                                <td><strong>${escapeHtml(e.full_name)}</strong></td>
                                <td><span class="badge ${e.kpi_target >= 80 ? 'badge-success' : 'badge-warning'}">${e.kpi_target || 100}%</span></td>
                                <td>${Math.floor(Math.random() * 20) + 5}</td>
                                <td class="text-danger">${fines > 0 ? fines.toLocaleString() + ' so\'m' : '—'}</td>
                                <td><span class="rank-medal">${medal}</span></td>
                                <td><span class="badge ${e.kpi_target >= 80 ? 'badge-success' : 'badge-info'}">${rec}</span></td>
                            </tr>
                        `;
                }).join('');
            } catch (e) {}
        }

        // ===== HR: CHAT =====
        async function loadChatEmployees() {
            try {
                const res = await fetch(`${API}/hr/employees`, { headers: { 'hr-id': hrId } });
                const employees = await res.json();
                const select = document.getElementById('chatEmployee');
                select.innerHTML = `<option value="">-- Xodim tanlang --</option>` +
                    employees.filter(e => e.is_active).map(e =>
                        `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`).join('');
            } catch (e) {}
        }

        function onChatEmployeeSelect() {
            const select = document.getElementById('chatEmployee');
            const selected = select.options[select.selectedIndex];
            if (selected && selected.value) {
                selectedEmployeeId = parseInt(selected.value);
                selectedEmployeeName = selected.text;
                document.getElementById('selectedChatInfo').style.display = 'inline-block';
                document.getElementById('selectedChatName').textContent = selectedEmployeeName;
                document.getElementById('chatStatus').textContent = `💬 ${selectedEmployeeName} bilan suhbat`;
                document.getElementById('chatInput').disabled = false;
                document.getElementById('chatSendBtn').disabled = false;
                loadChat();
            } else {
                selectedEmployeeId = null;
                selectedEmployeeName = '';
                document.getElementById('selectedChatInfo').style.display = 'none';
                document.getElementById('chatStatus').textContent = 'Xodim tanlang';
                document.getElementById('chatInput').disabled = true;
                document.getElementById('chatSendBtn').disabled = true;
                document.getElementById('chatContainer').innerHTML =
                    '<div class="empty-state"><i class="fas fa-comment"></i> Xodim tanlang va suhbatni boshlang</div>';
            }
        }

        async function loadChat() {
            if (!selectedEmployeeId) {
                showNotification('Iltimos, avval xodim tanlang!', 'warning');
                return;
            }
            const container = document.getElementById('chatContainer');
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Yuklanmoqda...</div>';
            try {
                const res = await fetch(`${API}/hr/chat/history/${selectedEmployeeId}`, { headers: { 'hr-id': hrId } });
                const messages = await res.json();
                if (!messages || messages.length === 0) {
                    container.innerHTML = '<div class="empty-state"><i class="fas fa-comment"></i> Hozircha xabarlar yo\'q</div>';
                    return;
                }
	                container.innerHTML = messages.map(msg => `
	                        <div class="chat-msg ${msg.sender === 'hr' ? 'hr' : 'employee'}">
	                            <span class="sender">${msg.sender === 'hr' ? '👔 HR' : '👤 Xodim'}</span>
	                            ${escapeHtml(msg.message)}
	                            <span class="time">${new Date(msg.created_at).toLocaleTimeString('uz-UZ', {hour:'2-digit', minute:'2-digit'})}</span>
	                        </div>
	                    `).join('');
                container.scrollTop = container.scrollHeight;
            } catch (e) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i> Xatolik yuz berdi</div>';
            }
        }

        async function sendChat() {
            const input = document.getElementById('chatInput');
            const msg = input.value.trim();
            if (!msg || !selectedEmployeeId) {
                showNotification('Iltimos, xabar yozing va xodim tanlang!', 'warning');
                return;
            }
            const container = document.getElementById('chatContainer');
            const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
	            const div = document.createElement('div');
	            div.className = 'chat-msg hr';
	            div.innerHTML = `<span class="sender">👔 HR</span>${escapeHtml(msg)}<span class="time">${time}</span>`;
	            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            input.value = '';
            try {
	                await apiFetch('/hr/chat/send', jsonOptions({
	                    employee_id: selectedEmployeeId,
	                    message: msg
	                }, { 'hr-id': hrId }));
                showNotification('✅ Xabar yuborildi!', 'success');
            } catch (e) {
                showNotification('❌ Xabar yuborishda xatolik', 'error');
            }
        }

        // ===== HR: QOIDALAR =====
        async function loadRules() {
            try {
                const [late, task, kpi, bonus] = await Promise.all([
                    fetch(`${API}/hr/rules/fine_late`, { headers: { 'hr-id': hrId } }).then(r => r.json()),
                    fetch(`${API}/hr/rules/fine_task`, { headers: { 'hr-id': hrId } }).then(r => r.json()),
                    fetch(`${API}/hr/rules/kpi_min`, { headers: { 'hr-id': hrId } }).then(r => r.json()),
                    fetch(`${API}/hr/rules/bonus_early`, { headers: { 'hr-id': hrId } }).then(r => r.json())
                ]);
                document.getElementById('ruleLate').value = late.value || 50000;
                document.getElementById('ruleTask').value = task.value || 100000;
                document.getElementById('ruleKpi').value = kpi.value || 60;
                document.getElementById('ruleBonus').value = bonus.value || 50000;
            } catch (e) {}
        }

        async function saveRules() {
            const late = document.getElementById('ruleLate').value;
            const task = document.getElementById('ruleTask').value;
            const kpi = document.getElementById('ruleKpi').value;
	            const bonus = document.getElementById('ruleBonus').value;
	            try {
	                await Promise.all([
	                    apiFetch('/hr/rules/fine_late', patchJsonOptions({ value: late }, { 'hr-id': hrId })),
	                    apiFetch('/hr/rules/fine_task', patchJsonOptions({ value: task }, { 'hr-id': hrId })),
	                    apiFetch('/hr/rules/kpi_min', patchJsonOptions({ value: kpi }, { 'hr-id': hrId })),
	                    apiFetch('/hr/rules/bonus_early', patchJsonOptions({ value: bonus }, { 'hr-id': hrId }))
	                ]);
                showNotification('✅ Qoidalar saqlandi!', 'success');
            } catch (e) { showNotification('❌ Xatolik', 'error'); }
        }

        // =============================================
        // ===== SUPPORT =====
        // =============================================

        async function loadSupport() {
            try {
                let url = `${API}/yourhr/support/tickets`;
                if (userRole === 'hr') {
                    url = `${API}/hr/support/tickets`;
                }
                const headers = userRole === 'hr' ? { 'hr-id': hrId } : {};
                const res = await fetch(url, { headers });
                const tickets = await res.json();
                renderSupport(tickets);
            } catch (e) {}
        }

        function renderSupport(tickets) {
            const tbody = document.getElementById('supportTable');
            const filter = document.getElementById('supportFilter').value;
            const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
            if (!filtered || filtered.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="8" class="empty-state"><i class="fas fa-ticket-alt"></i> Ticketlar mavjud emas</td></tr>`;
                return;
            }
            tbody.innerHTML = filtered.map(t => `
                    <tr>
                        <td>${t.id}</td>
                        <td>${escapeHtml(t.company_name || t.hr_name || '-')}</td>
                        <td>${escapeHtml(t.employee_name || '-')}</td>
                        <td><strong>${escapeHtml(t.title)}</strong><br><small style="color:#94a3b8;">${t.description ? escapeHtml(t.description.substring(0, 50)) + '...' : ''}</small></td>
                        <td><span class="badge ${t.status === 'open' ? 'badge-warning' : t.status === 'resolved' ? 'badge-success' : 'badge-info'}">${escapeHtml(t.status)}</span></td>
                        <td>${escapeHtml(t.admin_response || 'Javob yo\'q')}</td>
                        <td>${new Date(t.created_at).toLocaleDateString('uz-UZ')}</td>
                        <td>
                            ${userRole === 'admin' && t.status !== 'resolved' ? `
                                <button onclick="adminRespondTicket(${t.id})" class="btn btn-primary btn-sm"><i class="fas fa-reply"></i> Javob</button>
                            ` : ''}
                            ${userRole === 'hr' && t.status === 'open' ? `
                                <button onclick="hrRespondTicket(${t.id})" class="btn btn-primary btn-sm"><i class="fas fa-reply"></i> Javob</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
        }

        function showSupportModal() {
            document.getElementById('supportForm').reset();
            document.getElementById('supportModal').classList.add('active');
        }

	        async function saveSupport(e) {
	            e.preventDefault();
	            const data = {
	                title: document.getElementById('supportTitle').value.trim(),
	                description: document.getElementById('supportDesc').value.trim(),
	                category: document.getElementById('supportCategory').value
	            };
	    
	            try {
	                let path = '/yourhr/support/tickets';
	                const headers = {};
	                if (userRole === 'hr') {
	                    path = '/hr/support/tickets';
	                    headers['hr-id'] = hrId;
	                }
	                await apiFetch(path, jsonOptions(data, headers));
	                closeModal('supportModal');
                showNotification('✅ Ticket yuborildi!', 'success');
                loadSupport();
                loadDashboard();
            } catch (err) { showNotification('❌ ' + err.message, 'error'); }
        }

	        async function adminRespondTicket(id) {
	            const response = prompt('Javobingizni yozing:');
	            if (response === null) return;
	            try {
	                await apiFetch(`/yourhr/support/tickets/${id}`, patchJsonOptions({
	                    admin_response: response,
	                    status: 'resolved'
	                }));
	                showNotification('✅ Javob yuborildi!', 'success');
	                loadSupport();
	            } catch (e) { showNotification('❌ ' + e.message, 'error'); }
	        }

	        async function hrRespondTicket(id) {
	            const response = prompt('Javobingizni yozing:');
	            if (response === null) return;
	            try {
	                await apiFetch(`/hr/support/tickets/${id}`, patchJsonOptions({
	                    admin_response: response,
	                    status: 'in_progress'
	                }, { 'hr-id': hrId }));
	                showNotification('✅ Javob yuborildi!', 'success');
	                loadSupport();
	            } catch (e) { showNotification('❌ ' + e.message, 'error'); }
	        }

        // =============================================
        // ===== LOAD ALL =====
        // =============================================

        async function loadAll() {
            await loadDashboard();
            if (userRole === 'admin') {
                await loadCompanies();
                await loadHrs();
                await loadSupport();
            } else {
                await loadEmployees();
                await loadTasks();
                await loadAttendance();
                await loadReports();
                await loadFinancial();
                await loadAnalytics();
                await loadSupport();
                await loadRules();
            }
        }

        function exportReport() {
            showNotification('📊 Hisobot yuklanmoqda...', 'info');
            setTimeout(() => {
                const data = {
                    timestamp: new Date().toISOString(),
                    role: userRole,
                    user: currentUser?.full_name || 'Admin'
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `report-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                showNotification('✅ Hisobot yuklandi!', 'success');
            }, 1000);
        }

        // ===== INIT =====
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';

        document.getElementById('chatInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChat();
            }
        });
