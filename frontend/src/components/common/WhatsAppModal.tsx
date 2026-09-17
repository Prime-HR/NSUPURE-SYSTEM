import React, { useState, useEffect } from "react";
import { Send, Check, Copy, X, Calendar, FileText, UserCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { apiRequest } from "../../services/api.ts";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportType, setReportType] = useState<"FULL" | "PRODUCTION" | "SALES">("FULL");
  const [customNotes, setCustomNotes] = useState("");
  const [stats, setStats] = useState<any>(null);

  const centralPhone = "0248837001";
  const centralIntlPhone = "233248837001";

  // Worker & Timestamp information
  const workerName = user?.fullName || user?.username || "Factory Staff";
  const workerRole = user?.roles?.[0] || "OPERATOR";
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{
        data: {
          today: any;
          overall: any;
        };
      }>("/dashboard/overview");
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats for WhatsApp dispatch", err);
    } finally {
      setLoading(false);
    }
  };

  const generateMessage = (): string => {
    const today = stats?.data?.today || {};
    const overall = stats?.data?.overall || {};

    const goodBags = today.productionBags ?? 0;
    const totalBags = today.producedTotal ?? 0;
    const rejects = today.rejectedBags ?? 0;
    const rejectRate = today.rejectRate ?? 0;
    const salesBags = today.salesBags ?? 0;
    const revenue = today.revenue ?? 0;
    const cashReceived = today.cashReceived ?? 0;
    const creditSales = today.creditSales ?? 0;
    const expenses = today.expenses ?? 0;
    const cashInTill = overall.cashInTill ?? 0;

    let content = `💧 *NSUPURE MINERAL WATER* 💧\n`;
    content += `*Central Business Management Dispatch*\n`;
    content += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    content += `📅 *Date:* ${formattedDate} (${formattedTime})\n`;
    content += `👤 *Submitted By:* ${workerName} [${workerRole}]\n`;
    content += `🏢 *Facility:* Adumasa Factory Plant\n`;
    content += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (reportType === "FULL" || reportType === "PRODUCTION") {
      content += `🏭 *PRODUCTION & SHIFTS:*\n`;
      content += `• Good Bags (Stocked): *${goodBags.toLocaleString()} bags* (${(goodBags * 30).toLocaleString()} sachets)\n`;
      content += `• Total Run Output: ${totalBags.toLocaleString()} bags\n`;
      content += `• Damaged / Rejects: ${rejects} bags (${rejectRate}% rate)\n`;
      content += `• Working Window: 1 to 6 Hours Shift\n\n`;
    }

    if (reportType === "FULL" || reportType === "SALES") {
      content += `💰 *SALES & CASH COLLECTIONS:*\n`;
      content += `• Bags Sold: *${salesBags.toLocaleString()} bags*\n`;
      content += `• Total Sales Value: *GHS ${Number(revenue).toFixed(2)}*\n`;
      content += `• Cash Collected: *GHS ${Number(cashReceived).toFixed(2)}*\n`;
      if (creditSales > 0) {
        content += `• Outstanding Credit: GHS ${Number(creditSales).toFixed(2)}\n`;
      }
      if (expenses > 0) {
        content += `• Factory Expenses: GHS ${Number(expenses).toFixed(2)}\n`;
      }
      content += `• Balance in Cash Till: *GHS ${Number(cashInTill).toFixed(2)}*\n\n`;
    }

    if (customNotes.trim()) {
      content += `📝 *Staff Remarks:*\n${customNotes.trim()}\n\n`;
    }

    content += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    content += `_Sent via NSUPURE Management System to Central Office (${centralPhone})_`;

    return content;
  };

  const handleSendToWhatsApp = () => {
    const text = generateMessage();
    const url = `https://wa.me/${centralIntlPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Failed to copy message text");
    }
  };

  if (!isOpen) return null;

  const currentMessage = generateMessage();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Send Data to WhatsApp</h3>
              <p className="text-xs text-slate-500 font-medium">
                Central Officer Number: <span className="font-mono font-bold text-emerald-700">{centralPhone}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender & Date Banner */}
        <div className="mt-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sender: <strong className="text-slate-900">{workerName}</strong> ({workerRole})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Report Scope Selector */}
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Report Scope</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setReportType("FULL")}
              className={`py-2 px-2 text-xs font-bold rounded-lg border transition text-center ${
                reportType === "FULL"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Full Daily Brief
            </button>
            <button
              type="button"
              onClick={() => setReportType("PRODUCTION")}
              className={`py-2 px-2 text-xs font-bold rounded-lg border transition text-center ${
                reportType === "PRODUCTION"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Production Only
            </button>
            <button
              type="button"
              onClick={() => setReportType("SALES")}
              className={`py-2 px-2 text-xs font-bold rounded-lg border transition text-center ${
                reportType === "SALES"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Sales & Cash
            </button>
          </div>
        </div>

        {/* Custom Notes */}
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Additional Notes / Comments (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. ECG Power was off for 30m, extra deliveries done, etc."
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Message Preview */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              WhatsApp Message Preview
            </span>
            <button
              type="button"
              onClick={handleCopyText}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
          </div>
          <div className="bg-slate-900 text-emerald-300 font-mono text-[11px] p-3 rounded-xl max-h-44 overflow-y-auto whitespace-pre-wrap border border-slate-800 leading-relaxed select-all">
            {loading ? "Generating report from database..." : currentMessage}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSendToWhatsApp}
            className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            SEND TO WHATSAPP ({centralPhone})
          </button>
        </div>
      </div>
    </div>
  );
};
