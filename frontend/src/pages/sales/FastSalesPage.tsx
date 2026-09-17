import React, { useState, useEffect } from "react";
import { ShoppingCart, CheckCircle, Printer, User, CreditCard, DollarSign } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Customer {
  id: string;
  customerCode: string;
  businessName: string;
  customerType: string;
  currentBalance: number;
  creditLimit: number;
  customPrice?: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  defaultPrice: number;
}

export const FastSalesPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const [quantity, setQuantity] = useState<number>(20);
  const [unitPrice, setUnitPrice] = useState<number>(7.0);
  const [amountReceived, setAmountReceived] = useState<number>(140.0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MOMO" | "BANK" | "CREDIT">("CASH");
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<{
    saleNumber: string;
    customer: string;
    bags: number;
    total: number;
    received: number;
    credit: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Customers & Products
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          apiRequest<{ customers: Customer[] }>("/customers"),
          apiRequest<{ products: Product[] }>("/products"),
        ]);

        if (custRes.data?.customers) {
          setCustomers(custRes.data.customers);
          // Default to WALK-IN CUSTOMER
          const walkin = custRes.data.customers.find((c) => c.customerCode === "CUST-WALKIN");
          if (walkin) {
            setSelectedCustomerId(walkin.id);
          } else if (custRes.data.customers[0]) {
            setSelectedCustomerId(custRes.data.customers[0].id);
          }
        }

        if (prodRes.data?.products) {
          setProducts(prodRes.data.products);
          const defaultP = prodRes.data.products[0];
          if (defaultP) {
            setSelectedProductId(defaultP.id);
            setUnitPrice(defaultP.defaultPrice || 7.0);
          }
        }
      } catch (err) {
        console.error("Failed to load POS data", err);
      }
    };

    loadInitialData();
  }, []);

  // Update total & received when quantity or price changes
  useEffect(() => {
    const total = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
    if (paymentMethod === "CASH" || paymentMethod === "MOMO" || paymentMethod === "BANK") {
      setAmountReceived(total);
    } else if (paymentMethod === "CREDIT") {
      setAmountReceived(0.0);
    }
  }, [quantity, unitPrice, paymentMethod]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const totalAmount = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
  const creditCreated = Math.max(0, Math.round((totalAmount - amountReceived + Number.EPSILON) * 100) / 100);

  const handleQuickQty = (bags: number) => {
    setQuantity(bags);
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedCustomerId || !selectedProductId || quantity <= 0) {
      setErrorMessage("Please select a customer, product, and positive quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest<{
        sale: {
          id: string;
          saleNumber: string;
          totalAmount: number;
          amountReceived: number;
          creditAmount: number;
        };
      }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: [
            {
              productId: selectedProductId,
              quantity,
              unitPrice,
            },
          ],
          amountReceived,
          paymentMethod,
          notes,
        }),
      });

      if (res.data?.sale) {
        setSuccessReceipt({
          saleNumber: res.data.sale.saleNumber,
          customer: selectedCustomer?.businessName || "Customer",
          bags: quantity,
          total: res.data.sale.totalAmount,
          received: res.data.sale.amountReceived,
          credit: res.data.sale.creditAmount,
        });

        // Reset form for next fast sale
        setNotes("");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to record sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Page Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-sky-600" />
            Fast Sales POS
          </h2>
          <p className="text-xs text-slate-500">Fast bag sales & instant cash / credit logging</p>
        </div>
        <span className="text-xs font-mono font-bold bg-sky-50 text-sky-700 px-3 py-1 rounded-full border border-sky-200">
          GH₵{unitPrice.toFixed(2)}/bag
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-medium">
          {errorMessage}
        </div>
      )}

      {/* Sale Form */}
      <form onSubmit={handleSubmitSale} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Customer Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Select Customer</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              const cust = customers.find((c) => c.id === e.target.value);
              if (cust?.customPrice) {
                setUnitPrice(cust.customPrice);
              } else {
                setUnitPrice(7.0);
              }
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName} {c.currentBalance > 0 ? `(Owes GH₵${c.currentBalance.toFixed(2)})` : ""}
              </option>
            ))}
          </select>
          {selectedCustomer && selectedCustomer.currentBalance > 0 && (
            <p className="text-[11px] text-amber-600 font-semibold mt-1">
              Outstanding debt: GH₵{selectedCustomer.currentBalance.toFixed(2)} (Credit limit: GH₵{selectedCustomer.creditLimit.toFixed(2)})
            </p>
          )}
        </div>

        {/* Quick Quantity Presets */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Quick Quantity (Bags)</label>
          <div className="grid grid-cols-5 gap-2">
            {[5, 10, 20, 40, 60].map((qty) => (
              <button
                type="button"
                key={qty}
                onClick={() => handleQuickQty(qty)}
                className={`py-2 rounded-xl text-sm font-black transition border ${
                  quantity === qty
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {qty}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Inputs: Quantity & Unit Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Exact Bags</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Price per Bag (GH₵)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.10"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 7.0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
          <div className="grid grid-cols-4 gap-2">
            {(["CASH", "MOMO", "BANK", "CREDIT"] as const).map((method) => (
              <button
                type="button"
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`py-2 text-xs font-bold rounded-xl border transition ${
                  paymentMethod === method
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Received / Credit Math Display */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">Total Amount Due:</span>
            <span className="text-lg font-black text-slate-900">GH₵{totalAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-600 font-medium">Amount Received:</label>
            <div className="flex items-center gap-1">
              <span className="font-mono text-slate-400">GH₵</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.50"
                value={amountReceived}
                onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0.0)}
                className="w-24 text-right bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2">
            <span className="text-slate-600 font-medium">Credit Created (Owed):</span>
            <span
              className={`font-black font-mono ${
                creditCreated > 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              GH₵{creditCreated.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-black text-sm rounded-xl shadow-md shadow-sky-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              CONFIRM & COMPLETE SALE
            </>
          )}
        </button>
      </form>

      {/* ------------------------------------------------------------- */}
      {/* SUCCESS RECEIPT MODAL                                         */}
      {/* ------------------------------------------------------------- */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100 printable-card">
            <div className="text-center mb-4 border-b border-dashed border-slate-300 pb-3">
              <h3 className="font-black text-base tracking-wide text-slate-900">
                NSUPURE MINERAL WATER
              </h3>
              <p className="text-[11px] text-slate-500">Adumasa Factory, Ghana</p>
              <div className="inline-block bg-sky-50 text-sky-700 font-mono text-[10px] px-2 py-0.5 rounded mt-1">
                Receipt #{successReceipt.saleNumber}
              </div>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{successReceipt.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity:</span>
                <span className="font-bold text-slate-800">{successReceipt.bags} Bags (500ml)</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1">
                <span className="text-slate-500">Total Bill:</span>
                <span className="font-black text-slate-900">GH₵{successReceipt.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cash Received:</span>
                <span className="font-bold text-emerald-600">GH₵{successReceipt.received.toFixed(2)}</span>
              </div>
              {successReceipt.credit > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>Balance Owed:</span>
                  <span>GH₵{successReceipt.credit.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                onClick={() => setSuccessReceipt(null)}
                className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition"
              >
                Next Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
