import React from 'react';
import { MapPin, Calendar, MoreVertical, Eye, Trash2, Edit2, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface InvestmentTableProps {
  investments: any[];
  loading: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const InvestmentTable: React.FC<InvestmentTableProps> = ({
  investments,
  loading,
  onView,
  onEdit,
  onDelete
}) => {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i} className="animate-pulse">
                <td className="px-6 py-4"><div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-32 mb-2"></div><div className="h-3 bg-slate-50 dark:bg-slate-900 rounded w-24"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-40"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20 ml-auto"></div></td>
                <td className="px-6 py-4"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-16 mx-auto"></div></td>
                <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-24 ml-auto"></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="text-slate-300 dark:text-slate-600" size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No records found</h3>
        <p className="text-slate-500 max-w-xs mx-auto mt-1">Try adjusting your filters or search terms to find what you're looking for.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest font-black">
          <tr>
            <th className="px-6 py-4">Investor</th>
            <th className="px-6 py-4">Project</th>
            <th className="px-6 py-4 text-right">Amount</th>
            <th className="px-6 py-4 text-center">ROI</th>
            <th className="px-6 py-4 text-center">Status</th>
            <th className="px-6 py-4 text-right">Date</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {investments.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    {inv.profiles?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{inv.profiles?.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{inv.profiles?.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    {inv.land_projects?.image ? (
                      <img src={inv.land_projects.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><MapPin size={16} className="text-slate-400" /></div>
                    )}
                  </div>
                  <div className="min-w-[150px]">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{inv.land_projects?.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black flex items-center gap-1">
                      <MapPin size={10} className="text-emerald-500" /> {inv.land_projects?.city || 'N/A'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">₹{Number(inv.amount).toLocaleString('en-IN')}</p>
                {inv.wallet_transactions?.[0]?.id && (
                   <p className="text-[9px] text-slate-400 font-medium mt-0.5">ID: {inv.wallet_transactions[0].id.slice(0, 8)}...</p>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs">
                  {inv.roi_rate}%
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className={clsx(
                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                  inv.status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  inv.status === 'Exited' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                  'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                )}>
                  {inv.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex flex-col items-end">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {new Date(inv.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {new Date(inv.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onView(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-all"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => onEdit(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
                    title="Edit Record"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                    title="Delete Record"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvestmentTable;
