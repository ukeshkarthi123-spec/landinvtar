import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CreditCard, Search, ExternalLink, CheckCircle, XCircle,
  Clock, RefreshCw, AlertCircle, X, User, Mail,
  Calendar, Hash, FileText, Activity
} from 'lucide-react';

const Payments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPaymentsData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch payment orders first
      const { data: payData, error: payError } = await supabase
        .from('payment_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (payError) throw payError;
      if (!payData || payData.length === 0) {
        setPayments([]);
        setLoading(false);
        return;
      }

      // 2. Fetch profiles separately
      const userIds = [...new Set(payData.map(p => p.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profileError) {
        console.warn('[Payments] Profile fetch warning:', profileError);
      }

      // 3. Merge
      const profileMap = (profiles || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
      const mergedData = payData.map(pay => ({
        ...pay,
        profiles: profileMap[pay.user_id] || { name: 'Unknown User', email: 'N/A' }
      }));

      setPayments(mergedData);
    } catch (err: any) {
      console.error('[Payments] Fetch Error:', err);
      setError(err.message || 'Failed to load transaction history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
  }, []);

  const handleShowDetails = (pay: any) => {
    setSelectedPayment(pay);
    setShowModal(true);
  };

  const filteredPayments = payments.filter(pay => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      pay.razorpay_payment_id?.toLowerCase().includes(s) ||
      pay.razorpay_order_id?.toLowerCase().includes(s) ||
      pay.profiles?.name?.toLowerCase().includes(s) ||
      pay.profiles?.email?.toLowerCase().includes(s);

    if (filter === 'All') return matchesSearch;
    return matchesSearch && pay.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-slate-500 text-sm">Track all Razorpay payments and order statuses.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPaymentsData}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            {['All', 'paid', 'failed', 'created'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all uppercase ${
                  filter === f
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Payment ID, Order ID or User..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="p-10 text-center text-red-600 bg-red-50/20">
            <AlertCircle size={32} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold">{error}</p>
            <button onClick={fetchPaymentsData} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">ID / Order</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Gateway</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-8">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : filteredPayments.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-mono font-bold text-emerald-600 truncate max-w-[120px]">{pay.razorpay_payment_id || 'PENDING'}</p>
                    <p className="text-[9px] font-mono text-slate-400 truncate max-w-[120px]">{pay.razorpay_order_id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[180px]">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{pay.profiles?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 truncate">{pay.profiles?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{Number(pay.amount).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">{pay.currency}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      pay.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : pay.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {pay.status === 'paid' ? <CheckCircle size={10} /> : pay.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                      {pay.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center">
                        <CreditCard size={12} className="text-blue-600" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Razorpay</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                    {new Date(pay.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleShowDetails(pay)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors border border-transparent hover:border-emerald-100 dark:hover:border-emerald-800 shadow-sm group"
                    >
                      <ExternalLink size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Modal */}
      {showModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Payment Details</h2>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Transaction Record</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: User & Status */}
                <div className="space-y-6">
                  <DetailItem
                    icon={User}
                    label="User Name"
                    value={selectedPayment.profiles?.name || 'Unknown'}
                  />
                  <DetailItem
                    icon={Mail}
                    label="User Email"
                    value={selectedPayment.profiles?.email || 'N/A'}
                  />
                  <DetailItem
                    icon={Activity}
                    label="Payment Status"
                    value={
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedPayment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        selectedPayment.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {selectedPayment.status}
                      </span>
                    }
                  />
                  <DetailItem
                    icon={Calendar}
                    label="Date & Time"
                    value={new Date(selectedPayment.created_at).toLocaleString()}
                  />
                </div>

                {/* Right Column: Financials & Gateway */}
                <div className="space-y-6">
                  <DetailItem
                    icon={RefreshCw}
                    label="Amount"
                    value={
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        ₹{Number(selectedPayment.amount).toLocaleString('en-IN')}
                        <span className="ml-1 text-xs text-slate-400 font-bold uppercase">{selectedPayment.currency}</span>
                      </span>
                    }
                  />
                  <DetailItem
                    icon={Hash}
                    label="Internal ID"
                    value={<span className="text-[10px] font-mono break-all">{selectedPayment.id}</span>}
                  />
                  <DetailItem
                    icon={FileText}
                    label="Razorpay Order ID"
                    value={<span className="text-[10px] font-mono break-all text-blue-600 dark:text-blue-400 font-bold">{selectedPayment.razorpay_order_id}</span>}
                  />
                  <DetailItem
                    icon={FileText}
                    label="Razorpay Payment ID"
                    value={<span className="text-[10px] font-mono break-all text-emerald-600 dark:text-emerald-400 font-bold">{selectedPayment.razorpay_payment_id || 'N/A'}</span>}
                  />
                </div>

                {/* Full Width Footer: Notes/Receipt */}
                <div className="col-span-full pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px] font-black tracking-[2px]">
                    <FileText size={14} />
                    <span>Additional Metadata</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Receipt</p>
                        <p className="text-xs font-mono mt-1">{selectedPayment.receipt || 'None'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Payment Signature</p>
                        <p className="text-[9px] font-mono mt-1 truncate" title={selectedPayment.razorpay_signature}>
                          {selectedPayment.razorpay_signature || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {selectedPayment.notes && Object.keys(selectedPayment.notes).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Notes</p>
                        <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
                          {JSON.stringify(selectedPayment.notes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-slate-50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-900/20"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: any }) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px] font-black tracking-[2px]">
      <Icon size={14} />
      <span>{label}</span>
    </div>
    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
      {value}
    </div>
  </div>
);

export default Payments;
