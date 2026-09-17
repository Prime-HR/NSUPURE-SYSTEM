import React, { useState, useEffect } from "react";
import { FileText, AlertTriangle, Plus, Upload, Calendar } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Document {
  id: string;
  documentCode: string;
  title: string;
  category: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  versions: Array<{
    versionNumber: number;
    fileName: string;
    uploadDate: string;
  }>;
}

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ documents: Document[] }>("/documents");
      if (res.data) setDocuments(res.data.documents);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            Compliance & Document Vault
          </h2>
          <p className="text-xs text-slate-500">
            Business permits, FDA/GSA certifications, water lab tests, and vehicle licenses
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Document Title</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Document #</th>
                <th className="p-3.5">Expiry Date</th>
                <th className="p-3.5">Version</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">Loading document vault...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No documents in vault yet.</td>
                </tr>
              ) : (
                documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-mono text-slate-500">{d.documentCode}</td>
                    <td className="p-3.5 font-bold text-slate-900">{d.title}</td>
                    <td className="p-3.5 text-slate-600">{d.category}</td>
                    <td className="p-3.5 font-mono text-slate-500">{d.documentNumber || "—"}</td>
                    <td className="p-3.5 text-slate-600">
                      {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString("en-GB") : "Permanent"}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-sky-700">
                      v{d.versions[0]?.versionNumber || 1}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
