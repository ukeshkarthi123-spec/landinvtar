import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Map,
  FileCheck,
  Wallet,
  CreditCard,
  ArrowDownCircle,
  Settings,
  Bell,
  BarChart3,
  LifeBuoy
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: FileCheck, label: 'KYC Verification', path: '/admin/kyc' },
  { icon: Map, label: 'Land Projects', path: '/admin/projects' },
  { icon: Wallet, label: 'Investments', path: '/admin/investments' },
  { icon: CreditCard, label: 'Payments', path: '/admin/payments' },
  { icon: ArrowDownCircle, label: 'Withdrawals', path: '/admin/withdrawals' },
  { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
  { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
  { icon: LifeBuoy, label: 'Customer Support', path: '/admin/support' },
  { icon: FileCheck, label: 'Activity Logs', path: '/admin/logs' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

const Sidebar = () => {
  const { user } = useAuth();

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">InvestLand</h1>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Admin Portal</p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"
            )}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold">
            {user?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Admin User</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
