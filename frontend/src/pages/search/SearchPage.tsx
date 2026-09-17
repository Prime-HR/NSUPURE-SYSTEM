import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Users, ShoppingCart, Package, Factory, Car, FileText, ArrowRight } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface SearchResults {
  customers: Array<{ id: string; customerCode: string; businessName: string; phone?: string; community?: string }>;
  sales: Array<{ id: string; saleNumber: string; totalAmount: number; customer: { businessName: string } }>;
  orders: Array<{ id: string; orderNumber: string; totalAmount: number; customer: { businessName: string } }>;
  batches: Array<{ id: string; batchNumber: string; totalGoodBags: number }>;
  vehicles: Array<{ id: string; registrationNumber: string; makeModel?: string }>;
  employees: Array<{ id: string; employeeCode: string; fullName: string; roleTitle: string }>;
  documents: Array<{ id: string; documentCode: string; title: string; category: string }>;
  loans: Array<{ id: string; loanCode: string; lenderName: string; currentBalance: number }>;
}

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const doSearch = async () => {
      if (!query.trim()) return;
      setLoading(true);
      try {
        const res = await apiRequest<{ results: SearchResults }>(`/search?q=${encodeURIComponent(query)}`);
        if (res.data) setResults(res.data.results);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    };

    doSearch();
  }, [query]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5 text-sky-600" />
          Global Search Results
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Showing matching records for query: <span className="font-bold font-mono text-sky-700">"{query}"</span>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Customers */}
          {results?.customers && results.customers.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600" /> Matching Customers ({results.customers.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {results.customers.map((c) => (
                  <div key={c.id} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{c.businessName}</p>
                      <p className="text-slate-500">{c.customerCode} • {c.community || "Adumasa"} • {c.phone || "No phone"}</p>
                    </div>
                    <Link to={`/customers`} className="text-sky-600 font-bold hover:underline flex items-center gap-1">
                      View CRM <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales */}
          {results?.sales && results.sales.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-600" /> Matching Sales ({results.sales.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {results.sales.map((s) => (
                  <div key={s.id} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{s.saleNumber}</p>
                      <p className="text-slate-500">Customer: {s.customer.businessName}</p>
                    </div>
                    <span className="font-black text-emerald-700">GH₵{s.totalAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Batches */}
          {results?.batches && results.batches.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Factory className="w-4 h-4 text-indigo-600" /> Production Batches ({results.batches.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {results.batches.map((b) => (
                  <div key={b.id} className="py-2 flex justify-between items-center text-xs">
                    <p className="font-mono font-bold text-slate-900">{b.batchNumber}</p>
                    <span className="text-slate-600 font-medium">{b.totalGoodBags} good bags</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
