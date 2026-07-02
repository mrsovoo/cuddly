# main.py - To'liq backend FastAPI
from fastapi import FastAPI, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import sqlite3
import hashlib
import secrets
import uvicorn
import os
from contextlib import contextmanager
from pathlib import Path

app = FastAPI(title="yourHR API", version="2.0.0")
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "yourhr.db"
ADMIN_LOGIN = os.getenv("YOURHR_ADMIN_LOGIN", "sohibjon")
ADMIN_PASSWORD = os.getenv("YOURHR_ADMIN_PASSWORD", "sohibjon2024")
ADMIN_NAME = os.getenv("YOURHR_ADMIN_NAME", "Sohibjon Sulaymonov")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== DATABASE =====
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def db_connection():
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

# ===== INIT DATABASE =====
def init_db():
    with db_connection() as conn:
        cursor = conn.cursor()
        
        # Companies
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                tin TEXT UNIQUE NOT NULL,
                address TEXT,
                phone TEXT,
                email TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # HR Users (company_id NULL for admin)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hr_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                full_name TEXT NOT NULL,
                login TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
        """)
        
        # Employees
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                full_name TEXT NOT NULL,
                position TEXT,
                salary REAL DEFAULT 0,
                kpi_target INTEGER DEFAULT 100,
                work_start TEXT DEFAULT '09:00',
                work_end TEXT DEFAULT '18:00',
                telegram_id TEXT,
                telegram_password TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
        """)
        
        # Tasks
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                assigned_to INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'pending',
                bonus_amount REAL DEFAULT 0,
                deadline TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (assigned_to) REFERENCES employees(id)
            )
        """)
        
        # Attendance
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                date DATE DEFAULT CURRENT_DATE,
                come_time TIMESTAMP,
                leave_time TIMESTAMP,
                total_hours REAL,
                is_late BOOLEAN DEFAULT 0,
                late_minutes INTEGER DEFAULT 0,
                fine_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # Daily Reports
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                date DATE DEFAULT CURRENT_DATE,
                report_text TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                admin_comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # Support Tickets
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER,
                hr_id INTEGER,
                employee_id INTEGER,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT DEFAULT 'other',
                status TEXT DEFAULT 'open',
                admin_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (hr_id) REFERENCES hr_users(id),
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # Chat Messages
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hr_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                sender TEXT NOT NULL,
                is_read BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hr_id) REFERENCES hr_users(id),
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # Notifications
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hr_id INTEGER,
                employee_id INTEGER,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                is_read BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hr_id) REFERENCES hr_users(id),
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # Rules
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                rule_key TEXT NOT NULL,
                rule_value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                UNIQUE(company_id, rule_key)
            )
        """)
        
        # Insert admin user
        cursor.execute("SELECT id FROM hr_users WHERE login = ?", (ADMIN_LOGIN,))
        if not cursor.fetchone():
            admin_hash = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()
            cursor.execute("""
                INSERT INTO hr_users (company_id, full_name, login, password_hash, is_active)
                VALUES (NULL, ?, ?, ?, 1)
            """, (ADMIN_NAME, ADMIN_LOGIN, admin_hash))
        
        conn.commit()
        print("✅ Database initialized successfully")

init_db()

# ===== MODELS =====
class CompanyCreate(BaseModel):
    name: str
    tin: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    tin: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class HrLogin(BaseModel):
    username: str
    password: str

class EmployeeCreate(BaseModel):
    full_name: str
    position: Optional[str] = None
    salary: Optional[float] = 0
    kpi_target: Optional[int] = 100
    work_start: Optional[str] = "09:00"
    work_end: Optional[str] = "18:00"
    telegram_id: Optional[str] = None
    telegram_password: Optional[str] = None

class TaskCreate(BaseModel):
    assigned_to: int
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    deadline: Optional[str] = None

class SupportTicketCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "other"
    employee_id: Optional[int] = None

class ChatMessageCreate(BaseModel):
    employee_id: int
    message: str

class RuleUpdate(BaseModel):
    value: str

class PasswordReset(BaseModel):
    new_password: str

class ReportUpdate(BaseModel):
    status: str
    admin_comment: Optional[str] = None

class TicketUpdate(BaseModel):
    status: str
    admin_response: Optional[str] = None

# ===== HELPERS =====
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def get_company_by_id(company_id: int):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM companies WHERE id = ?", (company_id,))
        return cursor.fetchone()

def create_notification(hr_id: int, title: str, message: str, type: str = "info", employee_id: int = None):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (hr_id, employee_id, title, message, type)
            VALUES (?, ?, ?, ?, ?)
        """, (hr_id, employee_id, title, message, type))
        return True

# ============================================================
# ===== AUTH ENDPOINTS =====
# ============================================================

@app.post("/api/yourhr/auth/login")
async def admin_login(login_data: HrLogin):
    if login_data.username == ADMIN_LOGIN and login_data.password == ADMIN_PASSWORD:
        return {
            "access_token": ADMIN_LOGIN,
            "token_type": "bearer",
            "user": {"id": 0, "full_name": ADMIN_NAME, "role": "admin"}
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/hr/auth/login")
async def hr_login(login_data: HrLogin):
    """HR login with company credentials"""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hr_users WHERE login = ?", (login_data.username,))
        hr = cursor.fetchone()
        if not hr:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(login_data.password, hr['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not hr['is_active']:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        if not hr['company_id']:
            raise HTTPException(status_code=403, detail="This account is not assigned to a partner company")
        
        company_name = None
        if hr['company_id']:
            comp = get_company_by_id(hr['company_id'])
            if comp:
                company_name = comp['name']
        
        return {
            "access_token": hr['login'],
            "token_type": "bearer",
            "user": {
                "id": hr['id'],
                "full_name": hr['full_name'],
                "login": hr['login'],
                "company_id": hr['company_id'],
                "company_name": company_name
            }
        }

# ============================================================
# ===== ADMIN: COMPANIES =====
# ============================================================

@app.get("/api/yourhr/companies")
async def get_companies():
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*, 
                   (SELECT COUNT(*) FROM employees WHERE company_id = c.id) as employee_count,
                   (SELECT login FROM hr_users WHERE company_id = c.id LIMIT 1) as hr_login
            FROM companies c
            ORDER BY c.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/yourhr/companies")
async def create_company(company: CompanyCreate):
    with db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM companies WHERE tin = ?", (company.tin,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Company with this TIN already exists")
        
        cursor.execute("""
            INSERT INTO companies (name, tin, address, phone, email)
            VALUES (?, ?, ?, ?, ?)
        """, (company.name, company.tin, company.address, company.phone, company.email))
        company_id = cursor.lastrowid
        
        hr_login = f"hr_{company_id}"
        hr_password = secrets.token_urlsafe(8)
        password_hash = hash_password(hr_password)
        cursor.execute("""
            INSERT INTO hr_users (company_id, full_name, login, password_hash, email)
            VALUES (?, ?, ?, ?, ?)
        """, (company_id, f"HR - {company.name}", hr_login, password_hash, company.email))
        hr_id = cursor.lastrowid
        
        default_rules = [
            ("fine_late", "50000"),
            ("fine_task", "100000"),
            ("kpi_min", "60"),
            ("bonus_early", "50000")
        ]
        for key, value in default_rules:
            cursor.execute("""
                INSERT INTO rules (company_id, rule_key, rule_value)
                VALUES (?, ?, ?)
            """, (company_id, key, value))
        
        conn.commit()
        
        return {
            "id": company_id,
            "name": company.name,
            "tin": company.tin,
            "hr": {
                "id": hr_id,
                "login": hr_login,
                "password": hr_password
            }
        }

@app.put("/api/yourhr/companies/{company_id}")
async def update_company(company_id: int, company: CompanyUpdate):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM companies WHERE id = ?", (company_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Company not found")
        
        updates = []
        values = []
        for key, value in company.dict(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{key} = ?")
                values.append(value)
        if updates:
            values.append(company_id)
            cursor.execute(f"UPDATE companies SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            conn.commit()
        
        return {"message": "Company updated successfully"}

@app.delete("/api/yourhr/companies/{company_id}")
async def delete_company(company_id: int):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM support_tickets WHERE company_id = ?", (company_id,))
        cursor.execute("DELETE FROM rules WHERE company_id = ?", (company_id,))
        cursor.execute("SELECT id FROM employees WHERE company_id = ?", (company_id,))
        employees = cursor.fetchall()
        for emp in employees:
            cursor.execute("DELETE FROM attendance WHERE employee_id = ?", (emp['id'],))
            cursor.execute("DELETE FROM daily_reports WHERE employee_id = ?", (emp['id'],))
            cursor.execute("DELETE FROM tasks WHERE assigned_to = ?", (emp['id'],))
            cursor.execute("DELETE FROM chat_messages WHERE employee_id = ?", (emp['id'],))
        cursor.execute("DELETE FROM employees WHERE company_id = ?", (company_id,))
        cursor.execute("DELETE FROM hr_users WHERE company_id = ?", (company_id,))
        cursor.execute("DELETE FROM companies WHERE id = ?", (company_id,))
        conn.commit()
        return {"message": "Company deleted successfully"}

# ============================================================
# ===== ADMIN: HR USERS =====
# ============================================================

@app.get("/api/yourhr/company-hr")
async def get_all_hrs():
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT h.*, c.name as company_name 
            FROM hr_users h
            LEFT JOIN companies c ON h.company_id = c.id
            WHERE h.login != 'sohibjon'
            ORDER BY h.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

@app.get("/api/yourhr/company-hr/{company_id}")
async def get_hr_by_company(company_id: int):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM hr_users 
            WHERE company_id = ? AND login != 'sohibjon'
        """, (company_id,))
        return [dict(row) for row in cursor.fetchall()]

@app.patch("/api/yourhr/company-hr/{hr_id}/password")
async def reset_hr_password(
    hr_id: int,
    payload: PasswordReset
):
    """HR parolini tiklash"""
    if not payload.new_password:
        raise HTTPException(status_code=400, detail="new_password parameter is required")
    
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM hr_users WHERE id = ?", (hr_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="HR not found")
        
        password_hash = hash_password(payload.new_password)
        cursor.execute("UPDATE hr_users SET password_hash = ? WHERE id = ?", (password_hash, hr_id))
        conn.commit()
        return {"message": "Password updated successfully"}

# ============================================================
# ===== ADMIN: DASHBOARD =====
# ============================================================

@app.get("/api/yourhr/dashboard/stats")
async def admin_dashboard_stats():
    with db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM companies")
        companies = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as count FROM hr_users WHERE login != 'sohibjon'")
        hrs = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as count FROM employees")
        employees = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'in_progress')")
        support = cursor.fetchone()
        
        return {
            "companies": companies['count'] if companies else 0,
            "hrs": hrs['count'] if hrs else 0,
            "employees": employees['count'] if employees else 0,
            "support": support['count'] if support else 0
        }

# ============================================================
# ===== ADMIN: SUPPORT TICKETS =====
# ============================================================

@app.get("/api/yourhr/support/tickets")
async def admin_get_tickets():
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*, c.name as company_name, h.full_name as hr_name, e.full_name as employee_name
            FROM support_tickets t
            LEFT JOIN companies c ON t.company_id = c.id
            LEFT JOIN hr_users h ON t.hr_id = h.id
            LEFT JOIN employees e ON t.employee_id = e.id
            ORDER BY t.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/yourhr/support/tickets")
async def admin_create_ticket(ticket: SupportTicketCreate):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO support_tickets (company_id, hr_id, employee_id, title, description, category, status)
            VALUES (?, ?, ?, ?, ?, ?, 'open')
        """, (None, None, ticket.employee_id, ticket.title, ticket.description, ticket.category))
        ticket_id = cursor.lastrowid
        conn.commit()
        return {"id": ticket_id, "message": "Support ticket created"}

@app.patch("/api/yourhr/support/tickets/{ticket_id}")
async def admin_update_ticket(ticket_id: int, payload: TicketUpdate):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE support_tickets 
            SET status = ?, admin_response = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (payload.status, payload.admin_response, ticket_id))
        conn.commit()
        return {"message": "Ticket updated"}

# ============================================================
# ===== HR: DASHBOARD =====
# ============================================================

@app.get("/api/hr/dashboard/stats")
async def hr_dashboard_stats(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr:
            raise HTTPException(status_code=404, detail="HR not found")
        company_id = hr['company_id']
        
        if not company_id:
            return {"employees": 0, "tasks": 0, "attendance_today": 0, "reports": 0, "avg_kpi": "0%", "support": 0}
        
        cursor.execute("SELECT COUNT(*) as count FROM employees WHERE company_id = ?", (company_id,))
        employees = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as count FROM tasks WHERE company_id = ? AND status = 'pending'", (company_id,))
        tasks = cursor.fetchone()
        
        cursor.execute("""
            SELECT COUNT(*) as count FROM attendance 
            WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ?)
            AND date = CURRENT_DATE AND status IN ('present', 'late')
        """, (company_id,))
        attendance = cursor.fetchone()
        
        cursor.execute("""
            SELECT COUNT(*) as count FROM daily_reports 
            WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ?) AND status = 'pending'
        """, (company_id,))
        reports = cursor.fetchone()
        
        cursor.execute("SELECT AVG(kpi_target) as avg_kpi FROM employees WHERE company_id = ?", (company_id,))
        avg_kpi = cursor.fetchone()
        
        cursor.execute("""
            SELECT COUNT(*) as count FROM support_tickets 
            WHERE company_id = ? AND status IN ('open', 'in_progress')
        """, (company_id,))
        support = cursor.fetchone()
        
        return {
            "employees": employees['count'] if employees else 0,
            "tasks": tasks['count'] if tasks else 0,
            "attendance_today": attendance['count'] if attendance else 0,
            "reports": reports['count'] if reports else 0,
            "avg_kpi": f"{int(avg_kpi['avg_kpi'] or 0)}%" if avg_kpi else "0%",
            "support": support['count'] if support else 0
        }

# ============================================================
# ===== HR: EMPLOYEES =====
# ============================================================

@app.get("/api/hr/employees")
async def get_employees(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return []
        
        cursor.execute("SELECT * FROM employees WHERE company_id = ? ORDER BY created_at DESC", (hr['company_id'],))
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/hr/employees")
async def create_employee(employee: EmployeeCreate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            raise HTTPException(status_code=400, detail="HR has no company assigned")
        
        cursor.execute("""
            INSERT INTO employees (company_id, full_name, position, salary, kpi_target, work_start, work_end, telegram_id, telegram_password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (hr['company_id'], employee.full_name, employee.position, employee.salary, employee.kpi_target,
              employee.work_start, employee.work_end, employee.telegram_id, employee.telegram_password))
        emp_id = cursor.lastrowid
        conn.commit()
        
        create_notification(hr_id, "Yangi xodim", f"{employee.full_name} qo'shildi", "success")
        return {"id": emp_id, "message": "Employee created"}

@app.delete("/api/hr/employees/{employee_id}")
async def delete_employee(employee_id: int, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM employees WHERE id = ?", (employee_id,))
        emp = cursor.fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or hr['company_id'] != emp['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("DELETE FROM attendance WHERE employee_id = ?", (employee_id,))
        cursor.execute("DELETE FROM daily_reports WHERE employee_id = ?", (employee_id,))
        cursor.execute("DELETE FROM tasks WHERE assigned_to = ?", (employee_id,))
        cursor.execute("DELETE FROM chat_messages WHERE employee_id = ?", (employee_id,))
        cursor.execute("DELETE FROM employees WHERE id = ?", (employee_id,))
        conn.commit()
        return {"message": "Employee deleted"}

# ============================================================
# ===== HR: TASKS =====
# ============================================================

@app.get("/api/hr/tasks")
async def get_tasks(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return []
        
        cursor.execute("""
            SELECT t.*, e.full_name as employee_name
            FROM tasks t
            LEFT JOIN employees e ON t.assigned_to = e.id
            WHERE t.company_id = ?
            ORDER BY t.created_at DESC
        """, (hr['company_id'],))
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/hr/tasks")
async def create_task(task: TaskCreate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            raise HTTPException(status_code=400, detail="HR has no company assigned")
        
        cursor.execute("SELECT id FROM employees WHERE id = ? AND company_id = ?", (task.assigned_to, hr['company_id']))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Employee not found")
        
        cursor.execute("""
            INSERT INTO tasks (company_id, assigned_to, title, description, priority, deadline)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (hr['company_id'], task.assigned_to, task.title, task.description, task.priority, task.deadline))
        task_id = cursor.lastrowid
        conn.commit()
        
        create_notification(hr_id, "Yangi vazifa", f"{task.title}", "info", task.assigned_to)
        return {"id": task_id, "message": "Task created"}

@app.patch("/api/hr/tasks/{task_id}/approve")
async def approve_task(task_id: int, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or hr['company_id'] != task['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("UPDATE tasks SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
        conn.commit()
        return {"message": "Task approved"}

@app.patch("/api/hr/tasks/{task_id}/reject")
async def reject_task(task_id: int, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or hr['company_id'] != task['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("UPDATE tasks SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
        conn.commit()
        return {"message": "Task rejected"}

@app.patch("/api/hr/tasks/{task_id}/complete")
async def complete_task(task_id: int, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id, assigned_to, title FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or hr['company_id'] != task['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("SELECT rule_value FROM rules WHERE company_id = ? AND rule_key = 'bonus_early'", (task['company_id'],))
        rule = cursor.fetchone()
        bonus = int(rule['rule_value']) if rule else 50000
        
        cursor.execute("UPDATE tasks SET status = 'completed', bonus_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (bonus, task_id))
        conn.commit()
        
        create_notification(hr_id, "Vazifa bajarildi", f"{task['title']} - bonus: {bonus} so'm", "success", task['assigned_to'])
        return {"message": "Task completed", "bonus": bonus}

# ============================================================
# ===== HR: ATTENDANCE =====
# ============================================================

@app.get("/api/hr/attendance/today")
async def get_today_attendance(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return []
        
        cursor.execute("""
            SELECT a.*, e.full_name as employee_name
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE e.company_id = ? AND a.date = CURRENT_DATE
            ORDER BY a.employee_id
        """, (hr['company_id'],))
        return [dict(row) for row in cursor.fetchall()]

# ============================================================
# ===== HR: DAILY REPORTS =====
# ============================================================

@app.get("/api/hr/reports/daily")
async def get_daily_reports(hr_id: int = Header(...), status: Optional[str] = None):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return []
        
        query = """
            SELECT r.*, e.full_name as employee_name
            FROM daily_reports r
            LEFT JOIN employees e ON r.employee_id = e.id
            WHERE e.company_id = ?
        """
        params = [hr['company_id']]
        if status:
            query += " AND r.status = ?"
            params.append(status)
        query += " ORDER BY r.created_at DESC"
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

@app.patch("/api/hr/reports/daily/{report_id}")
async def update_report_status(report_id: int, payload: ReportUpdate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT employee_id FROM daily_reports WHERE id = ?", (report_id,))
        report = cursor.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        cursor.execute("SELECT company_id FROM employees WHERE id = ?", (report['employee_id'],))
        emp = cursor.fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or hr['company_id'] != emp['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("""
            UPDATE daily_reports 
            SET status = ?, admin_comment = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (payload.status, payload.admin_comment, report_id))
        conn.commit()
        return {"message": "Report updated"}

# ============================================================
# ===== HR: RULES =====
# ============================================================

@app.get("/api/hr/rules/{rule_key}")
async def get_rule(rule_key: str, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return {"value": "0"}
        
        cursor.execute("SELECT rule_value FROM rules WHERE company_id = ? AND rule_key = ?", (hr['company_id'], rule_key))
        rule = cursor.fetchone()
        return {"value": rule['rule_value'] if rule else "0"}

@app.patch("/api/hr/rules/{rule_key}")
async def update_rule(rule_key: str, rule: RuleUpdate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            raise HTTPException(status_code=400, detail="HR has no company assigned")
        
        cursor.execute("""
            INSERT INTO rules (company_id, rule_key, rule_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(company_id, rule_key) DO UPDATE SET rule_value = ?, updated_at = CURRENT_TIMESTAMP
        """, (hr['company_id'], rule_key, rule.value, rule.value))
        conn.commit()
        return {"message": "Rule updated"}

# ============================================================
# ===== HR: SUPPORT TICKETS =====
# ============================================================

@app.get("/api/hr/support/tickets")
async def hr_get_tickets(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return []
        
        cursor.execute("""
            SELECT t.*, e.full_name as employee_name
            FROM support_tickets t
            LEFT JOIN employees e ON t.employee_id = e.id
            WHERE t.company_id = ?
            ORDER BY t.created_at DESC
        """, (hr['company_id'],))
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/hr/support/tickets")
async def hr_create_ticket(ticket: SupportTicketCreate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            raise HTTPException(status_code=400, detail="HR has no company assigned")
        
        cursor.execute("""
            INSERT INTO support_tickets (company_id, hr_id, employee_id, title, description, category, status)
            VALUES (?, ?, ?, ?, ?, ?, 'open')
        """, (hr['company_id'], hr_id, ticket.employee_id, ticket.title, ticket.description, ticket.category))
        ticket_id = cursor.lastrowid
        conn.commit()
        return {"id": ticket_id, "message": "Support ticket created"}

@app.patch("/api/hr/support/tickets/{ticket_id}")
async def hr_update_ticket(ticket_id: int, payload: TicketUpdate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM support_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or hr['company_id'] != ticket['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("""
            UPDATE support_tickets 
            SET status = ?, admin_response = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (payload.status, payload.admin_response, ticket_id))
        conn.commit()
        return {"message": "Ticket updated"}

# ============================================================
# ===== HR: CHAT =====
# ============================================================

@app.get("/api/hr/chat/history/{employee_id}")
async def get_chat_history(employee_id: int, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            return []
        
        cursor.execute("SELECT company_id FROM employees WHERE id = ?", (employee_id,))
        emp = cursor.fetchone()
        if not emp or emp['company_id'] != hr['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("""
            SELECT * FROM chat_messages 
            WHERE hr_id = ? AND employee_id = ?
            ORDER BY created_at ASC
        """, (hr_id, employee_id))
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/hr/chat/send")
async def send_chat_message(message: ChatMessageCreate, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM hr_users WHERE id = ?", (hr_id,))
        hr = cursor.fetchone()
        if not hr or not hr['company_id']:
            raise HTTPException(status_code=400, detail="HR has no company assigned")
        
        cursor.execute("SELECT company_id FROM employees WHERE id = ?", (message.employee_id,))
        emp = cursor.fetchone()
        if not emp or emp['company_id'] != hr['company_id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        cursor.execute("""
            INSERT INTO chat_messages (hr_id, employee_id, message, sender)
            VALUES (?, ?, ?, 'hr')
        """, (hr_id, message.employee_id, message.message))
        chat_id = cursor.lastrowid
        conn.commit()
        
        create_notification(hr_id, "Yangi xabar", f"{message.message[:50]}...", "info", message.employee_id)
        return {"id": chat_id, "message": "Message sent"}

# ============================================================
# ===== HR: NOTIFICATIONS =====
# ============================================================

@app.get("/api/hr/notifications")
async def get_notifications(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM notifications 
            WHERE hr_id = ? 
            ORDER BY created_at DESC
            LIMIT 50
        """, (hr_id,))
        return [dict(row) for row in cursor.fetchall()]

@app.patch("/api/hr/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND hr_id = ?", (notification_id, hr_id))
        conn.commit()
        return {"message": "Notification marked as read"}

@app.patch("/api/hr/notifications/read-all")
async def mark_all_notifications_read(hr_id: int = Header(...)):
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE hr_id = ?", (hr_id,))
        conn.commit()
        return {"message": "All notifications marked as read"}

# ============================================================
# ===== ROOT =====
# ============================================================

@app.get("/")
async def frontend():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/api")
async def root():
    return {
        "message": "Welcome to yourHR API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "admin": "/api/yourhr/...",
            "hr": "/api/hr/..."
        }
    }

# ============================================================
# ===== RUN =====
# ============================================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
