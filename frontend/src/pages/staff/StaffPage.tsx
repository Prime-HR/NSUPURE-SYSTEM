import React, { useState, useEffect } from "react";
import { UserCheck, Plus, CheckCircle, Clock, Shield, Key, X, DollarSign, Users, Trash2, UserX, AlertTriangle } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  roleTitle: string;
  phone: string | null;
  emergencyContact: string | null;
  basicMonthlySalary: number;
  paymentMethod: string;
  momoOrBankDetails: string | null;
  status: string;
}

interface Attendance {
  id: string;
  date: string;
  status: string;
  employee: { fullName: string; roleTitle: string };
}

interface PayrollRecord {
  id: string;
  payrollMonth: string;
  basicSalary: number;
  netPay: number;
  paymentStatus: string;
  paymentMethod: string;
  employee: { fullName: string };
}

interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  roles: string[];
}

export const StaffPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"directory" | "payroll" | "logins">("directory");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Staff Form State
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    roleTitle: "Machine Operator",
    phone: "",
    emergencyContact: "",
    basicMonthlySalary: 1000.0,
    paymentMethod: "CASH",
    momoOrBankDetails: "",
    createLogin: false,
    username: "",
    password: "",
    systemRole: "PRODUCTION_SUPERVISOR",
  });

  // New User Form State
  const [newUser, setNewUser] = useState({
    fullName: "",
    username: "",
    password: "",
    phone: "",
    role: "SALES",
  });

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [empRes, attRes, payRes, usrRes] = await Promise.all([
        apiRequest<{ employees: Employee[] }>("/staff/employees"),
        apiRequest<{ attendance: Attendance[] }>("/staff/attendance"),
        apiRequest<{ payroll: PayrollRecord[] }>("/staff/payroll"),
        apiRequest<{ users: SystemUser[] }>("/auth/users"),
      ]);
      if (empRes.data) setEmployees(empRes.data.employees);
      if (attRes.data) setAttendance(attRes.data.attendance);
      if (payRes.data) setPayroll(payRes.data.payroll);
      if (usrRes.data) setSystemUsers(usrRes.data.users);
    } catch (err) {
      console.error("Failed to load staff records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleClockIn = async (employeeId: string) => {
    try {
      await apiRequest("/staff/attendance", {
        method: "POST",
        body: JSON.stringify({ employeeId, status: "PRESENT" }),
      });
      fetchAllData();
    } catch (err) {
      alert((err as Error).message || "Attendance clock-in failed");
    }
  };

  const handlePaySalary = async (id: string) => {
    try {
      await apiRequest(`/staff/payroll/${id}/pay`, { method: "POST" });
      fetchAllData();
    } catch (err) {
      alert((err as Error).message || "Payroll payment failed");
    }
  };

  const handleGeneratePayroll = async () => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (!confirm(`Generate monthly payroll records for ${currentMonth} for all active employees?`)) return;

    try {
      setLoading(true);
      await apiRequest("/staff/payroll/generate", {
        method: "POST",
        body: JSON.stringify({ payrollMonth: currentMonth }),
      });
      alert(`Payroll for ${currentMonth} generated successfully!`);
      fetchAllData();
    } catch (err) {
      alert((err as Error).message || "Failed to generate payroll");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      // 1. Create Employee Record
      await apiRequest("/staff/employees", {
        method: "POST",
        body: JSON.stringify({
          fullName: newStaff.fullName,
          roleTitle: newStaff.roleTitle,
          phone: newStaff.phone,
          emergencyContact: newStaff.emergencyContact,
          basicMonthlySalary: Number(newStaff.basicMonthlySalary),
          paymentMethod: newStaff.paymentMethod,
          momoOrBankDetails: newStaff.momoOrBankDetails,
        }),
      });

      // 2. If Create Login Account is selected, also create the system user
      if (newStaff.createLogin && newStaff.username && newStaff.password) {
        await apiRequest("/auth/users", {
          method: "POST",
          body: JSON.stringify({
            username: newStaff.username,
            password: newStaff.password,
            fullName: newStaff.fullName,
            phone: newStaff.phone,
            roles: [newStaff.systemRole],
          }),
        });
      }

      setShowAddStaffModal(false);
      setNewStaff({
        fullName: "",
        roleTitle: "Machine Operator",
        phone: "",
        emergencyContact: "",
        basicMonthlySalary: 1000.0,
        paymentMethod: "CASH",
        momoOrBankDetails: "",
        createLogin: false,
        username: "",
        password: "",
        systemRole: "PRODUCTION_SUPERVISOR",
      });
      fetchAllData();
    } catch (err) {
      setModalError((err as Error).message || "Failed to create staff record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      await apiRequest("/auth/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          fullName: newUser.fullName,
          phone: newUser.phone,
          roles: [newUser.role],
        }),
      });

      setShowAddUserModal(false);
      setNewUser({
        fullName: "",
        username: "",
        password: "",
        phone: "",
        role: "SALES",
      });
      fetchAllData();
    } catch (err) {
      setModalError((err as Error).message || "Failed to create login user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!confirm(`Are you sure you want to remove or deactivate employee "${emp.fullName}" (${emp.roleTitle})?`)) {
      return;
    }
    try {
      const res = await apiRequest<{ message: string; action: string }>(`/staff/employees/${emp.id}`, {
        method: "DELETE",
      });
      alert(res.message || "Employee record updated");
      fetchAllData();
    } catch (err) {
      alert((err as Error).message || "Failed to remove employee");
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (user.username === "owner") {
      alert("The primary owner account cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete login account "${user.username}"?`)) {
      return;
    }
    try {
      const res = await apiRequest<{ message: string; action: string }>(`/auth/users/${user.id}`, {
        method: "DELETE",
      });
      alert(res.message || "User account updated");
      fetchAllData();
    } catch (err) {
      alert((err as Error).message || "Failed to delete user account");
    }
  };

  const handleToggleUserStatus = async (user: SystemUser) => {
    if (user.username === "owner") {
      alert("The primary owner account cannot be deactivated.");
      return;
    }
    const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await apiRequest(`/auth/users/${user.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAllData();
    } catch (err) {
      alert((err as Error).message || "Failed to update user status");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            Staff & System User Accounts
          </h2>
          <p className="text-xs text-slate-500">
            Factory operators, delivery drivers, sales cashiers, payroll & system login permissions
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowAddStaffModal(true)}
            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Register Staff Member
          </button>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition"
          >
            <Key className="w-4 h-4 text-amber-400" /> Create System Login
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === "directory" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Users className="w-4 h-4" /> Staff Directory & Attendance ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === "payroll" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <DollarSign className="w-4 h-4" /> Monthly Payroll ({payroll.length})
        </button>
        <button
          onClick={() => setActiveTab("logins")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === "logins" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Shield className="w-4 h-4" /> System User Logins ({systemUsers.length})
        </button>
      </div>

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === "directory" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-sm text-slate-900">Adumasa Factory Staff</h3>
            <span className="text-xs text-slate-500 font-mono">{employees.length} registered employees</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Staff Code</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Role / Responsibility</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Phone & MoMo</th>
                  <th className="p-3 text-right">Basic Salary</th>
                  <th className="p-3 text-center">Daily Attendance</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="p-4 text-center text-slate-400">Loading staff directory...</td></tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No employees registered yet. Click <strong>"Register Staff Member"</strong> above to add factory workers.
                    </td>
                  </tr>
                ) : (
                  employees.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-mono text-slate-500 font-bold">{e.employeeCode}</td>
                      <td className="p-3 font-bold text-slate-900">{e.fullName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                          {e.roleTitle}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            e.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        <div>{e.phone || "—"}</div>
                        {e.momoOrBankDetails && <div className="text-[10px] text-slate-400 font-mono">{e.momoOrBankDetails}</div>}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">
                        GH₵{e.basicMonthlySalary.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        {e.status === "ACTIVE" ? (
                          <button
                            onClick={() => handleClockIn(e.id)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <Clock className="w-3 h-3" /> Clock In
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Inactive</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteEmployee(e)}
                          title="Remove or deactivate employee"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYROLL */}
      {activeTab === "payroll" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-black text-sm text-slate-900">Monthly Payroll Disbursements</h3>
              <p className="text-[11px] text-slate-500">Monthly salary calculations (~GH₵1,000 baseline) and disbursement audit</p>
            </div>
            <button
              onClick={handleGeneratePayroll}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              Generate This Month's Payroll
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Period</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3 text-right">Basic Salary</th>
                  <th className="p-3 text-right">Net Payable</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payroll.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No payroll records generated yet. Click <strong>"Generate This Month's Payroll"</strong>.
                    </td>
                  </tr>
                ) : (
                  payroll.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-mono font-bold text-slate-700">{p.payrollMonth}</td>
                      <td className="p-3 font-bold text-slate-900">{p.employee.fullName}</td>
                      <td className="p-3 text-right text-slate-500">GH₵{p.basicSalary.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-slate-900">GH₵{p.netPay.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {p.paymentStatus !== "PAID" ? (
                          <button
                            onClick={() => handlePaySalary(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-[11px] transition"
                          >
                            Disburse GH₵{p.netPay.toFixed(2)}
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Disbursed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM LOGIN ACCOUNTS */}
      {activeTab === "logins" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-black text-sm text-slate-900">System Login Accounts & Roles</h3>
              <p className="text-[11px] text-slate-500">User accounts authorized to log into the mobile touch POS or web dashboards</p>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" /> New Login
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Username</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Assigned Role(s)</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3 text-center">Access Control</th>
                  <th className="p-3 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {systemUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono font-bold text-indigo-700">{u.username}</td>
                    <td className="p-3 font-bold text-slate-900">{u.fullName}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              r === "OWNER"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : r === "SALES"
                                ? "bg-emerald-100 text-emerald-800"
                                : r === "DRIVER"
                                ? "bg-blue-100 text-blue-800"
                                : r === "PRODUCTION_SUPERVISOR"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {u.username !== "owner" ? (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                            u.status === "ACTIVE"
                              ? "bg-amber-50 hover:bg-amber-100 text-amber-800"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {u.status === "ACTIVE" ? "Suspend Login" : "Activate Login"}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-bold">Primary Owner</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {u.username !== "owner" ? (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete user account"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTER STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                Register New Factory / Delivery Staff
              </h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl font-bold border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwame Mensah, Yaw Boateng"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Role / Job Title *</label>
                  <select
                    value={newStaff.roleTitle}
                    onChange={(e) => setNewStaff({ ...newStaff, roleTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="Delivery Driver (Aboboyaa)">Delivery Driver (Aboboyaa)</option>
                    <option value="Machine Operator">Machine Operator</option>
                    <option value="Packaging & Bagging Staff">Packaging & Bagging Staff</option>
                    <option value="Factory Cleaner & Sanitation">Factory Cleaner & Sanitation</option>
                    <option value="Sales / Gate Cashier">Sales / Gate Cashier</option>
                    <option value="Production Supervisor">Production Supervisor</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0244123456"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Basic Monthly Salary (GHS) *</label>
                  <input
                    type="number"
                    step="50"
                    min="100"
                    required
                    value={newStaff.basicMonthlySalary}
                    onChange={(e) => setNewStaff({ ...newStaff, basicMonthlySalary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={newStaff.paymentMethod}
                    onChange={(e) => setNewStaff({ ...newStaff, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="CASH">Physical Cash</option>
                    <option value="MOMO">Mobile Money (MTN / Telecel)</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">MoMo or Bank Details</label>
                <input
                  type="text"
                  placeholder="e.g. MTN MoMo: 0244123456 (Kwame Mensah)"
                  value={newStaff.momoOrBankDetails}
                  onChange={(e) => setNewStaff({ ...newStaff, momoOrBankDetails: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Login Account Checkbox */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStaff.createLogin}
                    onChange={(e) => setNewStaff({ ...newStaff, createLogin: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    Also Create System Login Account for this Staff Member
                  </span>
                </label>

                {newStaff.createLogin && (
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Login Username *</label>
                        <input
                          type="text"
                          required={newStaff.createLogin}
                          placeholder="e.g. driver_kwame"
                          value={newStaff.username}
                          onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase() })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono font-bold bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Initial Password *</label>
                        <input
                          type="password"
                          required={newStaff.createLogin}
                          placeholder="Min 6 characters"
                          value={newStaff.password}
                          onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">System Role *</label>
                      <select
                        value={newStaff.systemRole}
                        onChange={(e) => setNewStaff({ ...newStaff, systemRole: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold"
                      >
                        <option value="DRIVER">DRIVER (Delivery sheets, customer confirmation)</option>
                        <option value="SALES">SALES (Touch Fast POS, cash receipts, customer balances)</option>
                        <option value="PRODUCTION_SUPERVISOR">PRODUCTION_SUPERVISOR (Shift entries, batches, rejects)</option>
                        <option value="FINANCE">FINANCE (Cashbook, expenses, reconciliations)</option>
                        <option value="INVENTORY">INVENTORY (Sachet rolls, outer bags, stock counts)</option>
                        <option value="MANAGER">MANAGER (Full operational access except owner drawings)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE SYSTEM LOGIN USER DIRECTLY */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                Create New System Login Account
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl font-bold border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">User's Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yaw Boateng"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Login Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. driver_yaw, cashier_akosua"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. 0501234567"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Assigned System Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold"
                >
                  <option value="DRIVER">DRIVER (View assigned deliveries, record drop-offs)</option>
                  <option value="SALES">SALES (Touch Fast POS, receipt printing, customer credit)</option>
                  <option value="PRODUCTION_SUPERVISOR">PRODUCTION_SUPERVISOR (Daily production runs, meter counts)</option>
                  <option value="FINANCE">FINANCE (Cashbook counting, expenses, debt tracking)</option>
                  <option value="INVENTORY">INVENTORY (Sachet film, outer bags, chemical stock)</option>
                  <option value="MANAGER">MANAGER (Operational management & shift supervision)</option>
                  <option value="ADMINISTRATOR">ADMINISTRATOR (Full system admin access)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
