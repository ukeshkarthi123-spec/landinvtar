import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Shield, Bell, CreditCard, Lock, Palette,
  Database, Save, Loader2, CheckCircle2, AlertCircle,
  Monitor, Moon, Sun, X, RefreshCw,
  Smartphone, Wallet, Download, Upload,
  Hash, UserCheck, AppWindow
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

// --- TYPES ---
interface AppSettings {
  id: string;
  platform_name: string;
  platform_logo?: string;
  support_email: string;
  contact_number: string;
  company_address: string;
  currency: string;
  timezone: string;
  language: string;
  date_format: string;
  maintenance_mode: boolean;
  maintenance_message?: string;
  registration_enabled: boolean;
  investment_enabled: boolean;
  withdrawals_enabled: boolean;
  deposits_enabled: boolean;
  default_roi: number;
  min_investment: number;
  max_investment: number;
  min_withdrawal: number;
  withdrawal_fee: number;
  referral_commission: number;
  pan_verification: boolean;
  aadhaar_verification: boolean;
  bank_verification: boolean;
  selfie_verification: boolean;
  manual_review: boolean;
  auto_approval: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  admin_alerts: boolean;
  user_alerts: boolean;
  two_factor_auth: boolean;
  session_timeout: number;
  password_policy: string;
  max_login_attempts: number;
  device_verification: boolean;
  razorpay_enabled: boolean;
  upi_enabled: boolean;
  wallet_enabled: boolean;
  bank_transfer_enabled: boolean;
  cash_deposit_enabled: boolean;
  razorpay_key_id?: string;
  primary_color: string;
  accent_color: string;
  sidebar_style: string;
  layout_type: string;
  font_size: string;
  created_at: string;
  updated_at: string;
}

type TabKey = 'General' | 'Platform' | 'Investment' | 'KYC' | 'Notifications' | 'Security' | 'Payments' | 'Appearance' | 'Backup' | 'System';

// --- REUSABLE COMPONENTS ---

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex items-center gap-3 mb-8">
    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
      <Icon size={20} />
    </div>
    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[2px]">{title}</h2>
  </div>
);

const FieldGroup = ({ label, children, description, error }: { label: string; children: React.ReactNode; description?: string; error?: string }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{label}</label>
    {children}
    {error && <p className="text-[10px] text-red-500 font-bold ml-1">{error}</p>}
    {description && <p className="text-[10px] text-slate-400 font-medium ml-1 leading-relaxed">{description}</p>}
  </div>
);

const SettingsInput = memo((props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={clsx(
      "w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 disabled:opacity-50",
      props.className
    )}
  />
));

const SettingsToggle = memo(({ enabled, onChange, label, description }: { enabled: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
  <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 transition-all hover:border-slate-200 dark:hover:border-slate-700">
    <div className="flex-1 pr-4">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</p>
      {description && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={clsx(
        "w-12 h-7 rounded-full relative transition-all shadow-inner",
        enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
      )}
    >
      <div className={clsx(
        "absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md",
        enabled ? "right-1" : "left-1"
      )} />
    </button>
  </div>
));

const SettingsSelect = memo(({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative group">
    <select
      {...props}
      className={clsx(
        "w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold dark:text-slate-100 appearance-none cursor-pointer",
        props.className
      )}
    >
      {children}
    </select>
    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
      <Monitor size={14} />
    </div>
  </div>
));

// --- MAIN MODULE ---

export default function Settings() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('General');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [passwords, setPasswords] = useState({
    new: '',
    confirm: ''
  });

  const syncSettings = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setConfig(data);
      } else {
        const { data: initData, error: initError } = await supabase
          .from('app_settings')
          .insert([{}])
          .select()
          .single();

        if (initError) throw initError;
        setConfig(initData);
      }
    } catch (err: any) {
      console.error("[Settings] Critical Error:", err);
      setError(err.message || "Platform configuration cache failed to synchronize.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/login');
      return;
    }
    if (session) {
      syncSettings();
    }
  }, [session, authLoading, navigate, syncSettings]);

  const handleSave = async () => {
    if (!config?.id || !session) return;
    setSaving(true);
    setToast(null);

    try {
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          ...config,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (updateError) throw updateError;

      setToast({ type: 'success', message: `${activeTab} updates synchronized successfully.` });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || "Persist failure: Network or RLS mismatch." });
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<AppSettings>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
  };

  const handleSignOutAll = async () => {
    if (!confirm('Invalidate all active sessions and log out?')) return;
    setSaving(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      navigate('/login');
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setToast({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      setToast({ type: 'success', message: 'Security credentials updated.' });
      setPasswords({ new: '', confirm: '' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investland-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ type: 'success', message: 'Configuration exported successfully.' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const { id, created_at, ...rest } = parsed;
        update(rest);
        setToast({ type: 'success', message: 'Backup loaded. Click Synchronize to save it.' });
      } catch {
        setToast({ type: 'error', message: 'Invalid backup file — could not parse JSON.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleGenesisReset = async () => {
    if (!config?.id || !session) return;
    if (!confirm('Factory reset will wipe all platform overrides. Continue?')) return;
    setSaving(true);
    try {
      const defaults = {
        maintenance_mode: false, registration_enabled: true, investment_enabled: true,
        withdrawals_enabled: true, deposits_enabled: true, default_roi: 12,
        min_investment: 500, max_investment: 1000000, min_withdrawal: 100,
        withdrawal_fee: 0, referral_commission: 5, two_factor_auth: false,
        session_timeout: 3600, max_login_attempts: 5, device_verification: false,
        primary_color: '#10B981', accent_color: '#059669', sidebar_style: 'modern',
        layout_type: 'sidebar', font_size: 'medium', updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('app_settings').update(defaults).eq('id', config.id);
      if (error) throw error;
      await syncSettings();
      setToast({ type: 'success', message: 'Platform reset to factory defaults.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Reset failed.' });
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: TabKey, icon: any }[] = [
    { key: 'General', icon: Globe },
    { key: 'Platform', icon: AppWindow },
    { key: 'Investment', icon: Wallet },
    { key: 'KYC', icon: UserCheck },
    { key: 'Notifications', icon: Bell },
    { key: 'Security', icon: Lock },
    { key: 'Payments', icon: CreditCard },
    { key: 'Appearance', icon: Palette },
    { key: 'Backup', icon: Database },
    { key: 'System', icon: Hash },
  ];

  if (authLoading || (loading && !error)) return (
    <div className="flex flex-col items-center justify-center min-h-[600px] gap-6 animate-in fade-in duration-700">
      <div className="relative">
        <Loader2 className="animate-spin text-emerald-500" size={56} strokeWidth={3} />
        <div className="absolute inset-0 blur-xl bg-emerald-500/20 rounded-full animate-pulse" />
      </div>
      <p className="text-slate-400 font-black uppercase tracking-[5px] text-[10px]">Initializing Architecture</p>
    </div>
  );

  if (error && !config) return (
    <div className="max-w-xl mx-auto mt-20 p-10 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-[40px] text-center space-y-6">
      <AlertCircle className="mx-auto text-red-500" size={48} />
      <h2 className="text-2xl font-black text-red-600">Sync Interrupted</h2>
      <p className="text-sm text-red-500 font-medium leading-relaxed">{error}</p>
      <div className="flex justify-center gap-3">
        <button onClick={() => navigate('/login')} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Back to Login</button>
        <button onClick={syncSettings} className="px-6 py-3 bg-red-600 text-white rounded-[20px] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-red-600/20 hover:scale-[1.02] transition-all">Retry Handshake</button>
      </div>
    </div>
  );

  if (!config) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4 sm:px-0">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">System</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold flex items-center gap-2">
            <Hash size={14} className="text-emerald-500" />
            Node: {config.id}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-3 px-10 py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-[24px] text-xs font-black uppercase tracking-[3px] shadow-2xl hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Synchronize
        </button>
      </div>

      {toast && (
        <div className={clsx(
          "p-4 rounded-2xl flex items-center gap-3 font-bold text-sm animate-in slide-in-from-top duration-300",
          toast.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800" : "bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:border-red-800"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity"><X size={16}/></button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="w-full lg:w-80 shrink-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-1 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setToast(null); }}
              className={clsx(
                "group flex items-center gap-4 px-6 py-4.5 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all text-left",
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-2xl shadow-emerald-500/10 border border-slate-100 dark:border-slate-800 scale-[1.02]"
                  : "bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent hover:bg-white dark:hover:bg-slate-800 shadow-sm"
              )}
            >
              <tab.icon size={18} className={clsx("transition-transform group-hover:scale-110", activeTab === tab.key ? "text-emerald-500" : "text-slate-300 dark:text-slate-700")} />
              {tab.key}
            </button>
          ))}
        </aside>

        <main className="flex-1 bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-12 min-h-[700px] w-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

          {activeTab === 'General' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Core Identity" icon={Globe} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <FieldGroup label="Platform Name">
                  <SettingsInput value={config.platform_name} onChange={e => update({ platform_name: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Support Hotline">
                  <SettingsInput value={config.contact_number} onChange={e => update({ contact_number: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Official Email">
                  <SettingsInput type="email" value={config.support_email} onChange={e => update({ support_email: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Company Address">
                  <SettingsInput value={config.company_address} onChange={e => update({ company_address: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Local Timezone">
                  <SettingsSelect value={config.timezone} onChange={e => update({ timezone: e.target.value })}>
                    <option value="Asia/Kolkata">Asia/Kolkata (GMT +5:30)</option>
                    <option value="UTC">UTC (GMT 0)</option>
                  </SettingsSelect>
                </FieldGroup>
                <FieldGroup label="System Currency">
                  <SettingsSelect value={config.currency} onChange={e => update({ currency: e.target.value })}>
                    <option value="INR">INR (₹) Indian Rupee</option>
                    <option value="USD">USD ($) US Dollar</option>
                  </SettingsSelect>
                </FieldGroup>
              </div>

              <div className="pt-10 border-t border-slate-50 dark:border-slate-800 space-y-6">
                <h3 className="text-sm font-black uppercase tracking-[4px] flex items-center gap-3 text-slate-900 dark:text-white">
                  <Monitor size={18} className="text-orange-500" />
                  Service Availability
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <SettingsToggle
                    label="Maintenance Mode"
                    description="Block all public access except admins"
                    enabled={config.maintenance_mode}
                    onChange={v => update({ maintenance_mode: v })}
                  />
                  <FieldGroup label="System Message">
                    <SettingsInput
                      disabled={!config.maintenance_mode}
                      value={config.maintenance_message}
                      onChange={e => update({ maintenance_message: e.target.value })}
                      placeholder="Maintenance details..."
                    />
                  </FieldGroup>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Platform' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Runtime Controls" icon={AppWindow} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SettingsToggle label="New Registrations" description="Allow new user account creation" enabled={config.registration_enabled} onChange={v => update({ registration_enabled: v })} />
                <SettingsToggle label="Asset Investment" description="Global switch for buying fractional land" enabled={config.investment_enabled} onChange={v => update({ investment_enabled: v })} />
                <SettingsToggle label="Withdrawal Requests" description="Allow users to move funds to bank" enabled={config.withdrawals_enabled} onChange={v => update({ withdrawals_enabled: v })} />
                <SettingsToggle label="Wallet Deposits" description="Enable global payment gateway for topups" enabled={config.deposits_enabled} onChange={v => update({ deposits_enabled: v })} />
              </div>
            </div>
          )}

          {activeTab === 'Investment' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Financial Nodes" icon={Wallet} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <FieldGroup label="Baseline ROI (%)" description="Default annual yield for new properties">
                  <SettingsInput type="number" value={config.default_roi} onChange={e => update({ default_roi: parseFloat(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Referral Reward (%)" description="Incentive for successful network invites">
                  <SettingsInput type="number" value={config.referral_commission} onChange={e => update({ referral_commission: parseFloat(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Minimum Stake (₹)">
                  <SettingsInput type="number" value={config.min_investment} onChange={e => update({ min_investment: parseInt(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Maximum Limit (₹)">
                  <SettingsInput type="number" value={config.max_investment} onChange={e => update({ max_investment: parseInt(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Min Payout (₹)">
                  <SettingsInput type="number" value={config.min_withdrawal} onChange={e => update({ min_withdrawal: parseInt(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Transaction Tax (%)">
                  <SettingsInput type="number" value={config.withdrawal_fee} onChange={e => update({ withdrawal_fee: parseFloat(e.target.value) })} />
                </FieldGroup>
              </div>
            </div>
          )}

          {activeTab === 'KYC' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Compliance Matrix" icon={UserCheck} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingsToggle label="PAN Card Audit" enabled={config.pan_verification} onChange={v => update({ pan_verification: v })} />
                <SettingsToggle label="Aadhaar Biometric Sync" enabled={config.aadhaar_verification} onChange={v => update({ aadhaar_verification: v })} />
                <SettingsToggle label="Penny-Drop Validation" enabled={config.bank_verification} onChange={v => update({ bank_verification: v })} />
                <SettingsToggle label="Face Match (AI)" enabled={config.selfie_verification} onChange={v => update({ selfie_verification: v })} />
                <SettingsToggle label="Admin Manual Review" enabled={config.manual_review} onChange={v => update({ manual_review: v })} />
                <SettingsToggle label="Instant Auto-Approval" enabled={config.auto_approval} onChange={v => update({ auto_approval: v })} />
              </div>
            </div>
          )}

          {activeTab === 'Notifications' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Alert Ecosystem" icon={Bell} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingsToggle label="Transactional Email" enabled={config.email_notifications} onChange={v => update({ email_notifications: v })} />
                <SettingsToggle label="SMS Gateway (Twilio)" enabled={config.sms_notifications} onChange={v => update({ sms_notifications: v })} />
                <SettingsToggle label="Push Engine (FCM)" enabled={config.push_notifications} onChange={v => update({ push_notifications: v })} />
                <SettingsToggle label="Administrative Security" enabled={config.admin_alerts} onChange={v => update({ admin_alerts: v })} />
                <SettingsToggle label="Global User Broadcasts" enabled={config.user_alerts} onChange={v => update({ user_alerts: v })} />
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Vault Protocol" icon={Lock} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <FieldGroup label="Login Retry Limit" description="Attempts before temporary lockout">
                  <SettingsInput type="number" value={config.max_login_attempts} onChange={e => update({ max_login_attempts: parseInt(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Authorization Window (s)" description="Automatic token invalidation period">
                  <SettingsInput type="number" value={config.session_timeout} onChange={e => update({ session_timeout: parseInt(e.target.value) })} />
                </FieldGroup>
                <FieldGroup label="Password Complexity">
                  <SettingsSelect value={config.password_policy} onChange={e => update({ password_policy: e.target.value })}>
                    <option value="standard">Standard (8+ characters)</option>
                    <option value="strong">Strong (Alpha-numeric + Special)</option>
                    <option value="strict">Strict (Regular resets required)</option>
                  </SettingsSelect>
                </FieldGroup>
              </div>
              <div className="space-y-4 pt-6 border-t border-slate-50 dark:border-slate-800">
                <SettingsToggle label="Multi-Factor Auth (MFA)" description="Enforce TOTP for all high-value movements" enabled={config.two_factor_auth} onChange={v => update({ two_factor_auth: v })} />
                <SettingsToggle label="Fingerprint Locking" description="Device-level biometric authorization" enabled={config.device_verification} onChange={v => update({ device_verification: v })} />
              </div>

              <div className="pt-10 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white mb-6 tracking-widest">Update Admin Credentials</h4>
                <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                  <SettingsInput required type="password" placeholder="New Strong Password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                  <SettingsInput required type="password" placeholder="Confirm Password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                  <button type="submit" disabled={saving} className="w-full py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 transition-all hover:bg-black">
                    {saving ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Update Security Keys'}
                  </button>
                </form>
              </div>

              <div className="pt-10 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Active Authorization</h4>
                  <p className="text-xs text-slate-500">Log out from all browsers instantly.</p>
                </div>
                <button onClick={handleSignOutAll} className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-red-700 transition-all">
                  Global Logout
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Payments' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Gateway Matrix" icon={CreditCard} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingsToggle label="Razorpay Bridge" enabled={config.razorpay_enabled} onChange={v => update({ razorpay_enabled: v })} />
                <SettingsToggle label="Unified Payments (UPI)" enabled={config.upi_enabled} onChange={v => update({ upi_enabled: v })} />
                <SettingsToggle label="Internal Ledger (Wallet)" enabled={config.wallet_enabled} onChange={v => update({ wallet_enabled: v })} />
                <SettingsToggle label="Direct NEFT/RTGS" enabled={config.bank_transfer_enabled} onChange={v => update({ bank_transfer_enabled: v })} />
                <SettingsToggle label="Physical Cash Deposit" enabled={config.cash_deposit_enabled} onChange={v => update({ cash_deposit_enabled: v })} />
              </div>
              <div className="p-8 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-[32px] space-y-4">
                <p className="text-xs font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest">Gateway Configuration</p>
                <FieldGroup label="Razorpay Key ID">
                  <SettingsInput value={config.razorpay_key_id} onChange={e => update({ razorpay_key_id: e.target.value })} placeholder="rzp_live_..." className="bg-white dark:bg-slate-900 font-mono text-xs" />
                </FieldGroup>
              </div>
            </div>
          )}

          {activeTab === 'Appearance' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Visual DNA" icon={Palette} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <FieldGroup label="Navigation Style">
                  <SettingsSelect value={config.sidebar_style} onChange={e => update({ sidebar_style: e.target.value })}>
                    <option value="modern">Modern Minimalist</option>
                    <option value="classic">Vertical Sidebar</option>
                    <option value="compact">Icon Only</option>
                  </SettingsSelect>
                </FieldGroup>
                <FieldGroup label="Layout Configuration">
                  <SettingsSelect value={config.layout_type} onChange={e => update({ layout_type: e.target.value })}>
                    <option value="sidebar">Left Navigation</option>
                    <option value="topbar">Top Navigation</option>
                  </SettingsSelect>
                </FieldGroup>
                <FieldGroup label="Typography Scale">
                  <SettingsSelect value={config.font_size} onChange={e => update({ font_size: e.target.value })}>
                    <option value="small">Precision (Small)</option>
                    <option value="medium">Balanced (Standard)</option>
                    <option value="large">Accessibility (Large)</option>
                  </SettingsSelect>
                </FieldGroup>
                <FieldGroup label="Primary Accent">
                  <div className="flex gap-4 items-center">
                    <SettingsInput type="color" value={config.primary_color} onChange={e => update({ primary_color: e.target.value })} className="w-20 h-14 p-1" />
                    <SettingsInput value={config.primary_color} onChange={e => update({ primary_color: e.target.value })} className="font-mono text-sm uppercase" />
                  </div>
                </FieldGroup>
              </div>
            </div>
          )}

          {activeTab === 'Backup' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Recovery & Genesis" icon={Database} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button onClick={handleExportBackup} className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[32px] border border-slate-100 dark:border-slate-800 text-left hover:scale-[1.01] transition-all group">
                  <Download className="text-blue-500 mb-4 group-hover:-translate-y-1 transition-transform" />
                  <p className="font-black text-sm uppercase tracking-widest text-slate-800 dark:text-white">Export Node State</p>
                  <p className="text-[10px] text-slate-400 mt-1">Snapshot current JSON configuration</p>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[32px] border border-slate-100 dark:border-slate-800 text-left hover:scale-[1.01] transition-all group">
                  <Upload className="text-orange-500 mb-4 group-hover:-translate-y-1 transition-transform" />
                  <p className="font-black text-sm uppercase tracking-widest text-slate-800 dark:text-white">Restore Backup</p>
                  <p className="text-[10px] text-slate-400 mt-1">Upload and apply previous node configuration</p>
                  <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
                </button>
                <button
                  onClick={handleGenesisReset}
                  disabled={saving}
                  className="p-8 bg-red-500/5 rounded-[32px] border border-red-500/10 text-left hover:bg-red-500 transition-all group lg:col-span-2 disabled:opacity-50"
                >
                  <RefreshCw className="text-red-500 group-hover:text-white mb-4 group-hover:rotate-180 duration-500 transition-all" />
                  <p className="font-black text-sm uppercase tracking-widest text-red-500 group-hover:text-white">Genesis Reset</p>
                  <p className="text-[10px] text-red-400 group-hover:text-red-100 mt-1">Wipe configuration and return to default defaults</p>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'System' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <SectionHeader title="Infrastructure Audit" icon={Hash} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Record UUID</p>
                  <p className="text-xs font-mono font-bold break-all dark:text-slate-100">{config.id}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Database Status</p>
                  <div className="flex items-center gap-2 text-emerald-500 font-bold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Synchronized
                  </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Platform Genesis</p>
                  <p className="text-sm font-bold dark:text-slate-100">{new Date(config.created_at).toLocaleString()}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Last Sync</p>
                  <p className="text-sm font-bold dark:text-slate-100">{new Date(config.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}