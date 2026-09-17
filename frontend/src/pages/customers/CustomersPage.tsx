import React, { useState, useEffect } from "react";
import { Users, Search, Plus, Printer, FileText, Phone, MapPin, X, ArrowUpRight } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Customer {
  id: string;
  customerCode: string;
  businessName: string;
  contactPerson: string | null;
  customerType: string;
  phone: string | null;
  community: string | null;
  currentBalance: number;
  creditLimit: number;
  creditTermsDays: number;
  status: string;
}

interface StatementEntry {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementData {
  statementTitle: string;
  enterpriseName: string;
  factoryLocation: string;
  customer: {
    code: string;
    name: string;
    contact: string;
    phone: string;
    community: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  entries: StatementEntry[];
  summary: {
    totalPurchases: number;
    totalPayments: number;
    outstandingBalance: number;
  };
}

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Statement Modal State
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // New Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustType, setNewCustType] = useState("DRINKING_SPOT");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustCommunity, setNewCustCommunity] = useState("Adumasa");
  const [newCustCreditLimit, setNewCustCreditLimit] = useState(200.0);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ customers: Customer[] }>(`/customers?search=${encodeURIComponent(search)}`);
      if (res.data) {
        setCustomers(res.data.customers);
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleOpenStatement = async (customerId: string) => {
    try {
      setLoadingStatement(true);
      const res = await apiRequest<StatementData>(`/customers/${customerId}/statement`);
      if (res.data) {
        setStatement(res.data);
      }
    } catch (err) {
      console.error("Failed to load statement", err);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/customers", {
        method: "POST",
        body: JSON.stringify({
          businessName: newCustName,
          customerType: newCustType,
          phone: newCustPhone,
          community: newCustCommunity,
          creditLimit: newCustCreditLimit,
        }),
      });
      setShowAddModal(false);
      setNewCustName("");
      setNewCustPhone("");
      fetchCustomers();
    } catch (err) {
      alert((err as Error).message || "Failed to create customer");
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            Customers & Credit Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Registered accounts, supply arrangements, and customer statements
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search by customer name, phone, or community..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
        />
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Customer / Business</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Community</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5 text-right">Balance Owed</th>
                <th className="p-3.5 text-right">Credit Limit</th>
                <th className="p-3.5 text-center">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    Loading customer ledger...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No customers found matching search.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-mono text-slate-500 font-medium">{c.customerCode}</td>
                    <td className="p-3.5 font-bold text-slate-900">{c.businessName}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {c.customerType}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {c.community || "—"}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {c.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3.5 text-right font-bold">
                      <span className={c.currentBalance > 0 ? "text-amber-600" : "text-emerald-600"}>
                        GH₵{c.currentBalance.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3.5 text-right text-slate-500">
                      GH₵{c.creditLimit.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleOpenStatement(c.id)}
                        className="p-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-[11px] inline-flex items-center gap-1 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Statement
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CUSTOMER STATEMENT MODAL (Section 17)                         */}
      {/* ------------------------------------------------------------- */}
      {statement && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 printable-card my-8">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
              <div>
                <h3 className="font-black text-lg text-slate-900 tracking-wide">
                  {statement.statementTitle}
                </h3>
                <p className="text-xs text-sky-700 font-bold">{statement.enterpriseName}</p>
                <p className="text-[11px] text-slate-500">{statement.factoryLocation}</p>
              </div>
              <div className="text-right flex items-center gap-2 no-print">
                <button
                  onClick={() => window.print()}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Statement
                </button>
                <button
                  onClick={() => setStatement(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer & Period Block */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Customer</p>
                <p className="font-bold text-slate-900 text-sm">{statement.customer.name}</p>
                <p className="text-slate-600">Code: {statement.customer.code}</p>
                <p className="text-slate-600">Phone: {statement.customer.phone || "N/A"}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Statement Period</p>
                <p className="font-bold text-slate-800">{statement.period.startDate} to {statement.period.endDate}</p>
                <p className="text-slate-600">Community: {statement.customer.community || "Adumasa"}</p>
              </div>
            </div>

            {/* Ledger Entries Table */}
            <div className="overflow-x-auto mb-4 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Reference</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Debit (GH₵)</th>
                    <th className="p-2.5 text-right">Credit (GH₵)</th>
                    <th className="p-2.5 text-right">Balance (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statement.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        No transactions recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    statement.entries.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 whitespace-nowrap text-slate-600">
                          {new Date(e.date).toLocaleDateString("en-GB")}
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{e.reference}</td>
                        <td className="p-2.5 font-medium text-slate-800">{e.description}</td>
                        <td className="p-2.5 text-right text-slate-900">
                          {e.debit > 0 ? e.debit.toFixed(2) : "—"}
                        </td>
                        <td className="p-2.5 text-right text-emerald-600">
                          {e.credit > 0 ? e.credit.toFixed(2) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {e.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Statement Summary Bottom Block */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center text-xs">
              <div>
                <p className="text-slate-400">Total Purchases (Debits):</p>
                <p className="font-bold text-sm">GH₵{statement.summary.totalPurchases.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-400">Total Payments (Credits):</p>
                <p className="font-bold text-sm text-emerald-400">GH₵{statement.summary.totalPayments.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-amber-400 font-bold">Outstanding Balance:</p>
                <p className="font-black text-base text-amber-300">GH₵{statement.summary.outstandingBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADD CUSTOMER MODAL                                            */}
      {/* ------------------------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-base text-slate-900">Add New Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Business / Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asantewaa Drinking Spot"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Type</label>
                <select
                  value={newCustType}
                  onChange={(e) => setNewCustType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="DRINKING_SPOT">Drinking Spot</option>
                  <option value="CHOP_BAR">Chop Bar</option>
                  <option value="SHOP">Provision Shop</option>
                  <option value="WHOLESALER">Wholesaler</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="SCHOOL">School</option>
                  <option value="OFFICE">Office</option>
                  <option value="INDIVIDUAL">Individual</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 0244123456"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Community</label>
                  <input
                    type="text"
                    placeholder="e.g. Bomfa, Peminase"
                    value={newCustCommunity}
                    onChange={(e) => setNewCustCommunity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Credit Limit (GH₵)</label>
                <input
                  type="number"
                  step="50"
                  value={newCustCreditLimit}
                  onChange={(e) => setNewCustCreditLimit(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-sm transition"
              >
                Register Customer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
