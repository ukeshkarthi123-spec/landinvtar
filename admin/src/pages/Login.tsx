import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      // Login
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Authentication failed.');
      }

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, is_admin')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
        throw profileError;
      }

      if (!profile) {
        throw new Error('Profile not found.');
      }

      // Check admin access
      const isAdmin =
        profile.is_admin === true ||
        profile.role === 'admin' ||
        profile.role === 'super_admin';

      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin privileges required.');
      }

      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-600">
            InvestLand
          </h1>

          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Admin Dashboard Login
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg p-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">

          <div>
            <label className="block text-sm font-medium mb-2">
              Email Address
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="admin24@gmail.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="********"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold flex justify-center items-center"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Sign In'
            )}
          </button>

        </form>

      </div>
    </div>
  );
};

export default Login;