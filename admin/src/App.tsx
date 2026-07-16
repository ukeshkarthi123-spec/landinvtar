import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import Users from './pages/Users';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import EditProject from './pages/EditProject';
import KYC from './pages/KYC';
import InvestmentRecords from './pages/InvestmentRecords';
import Payments from './pages/Payments';
import Withdrawals from './pages/Withdrawals';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import CustomerSupport from './pages/CustomerSupport';
import Login from './pages/Login';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, role, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Initializing Admin Session...</p>
      </div>
    </div>;
  }

  if (!session || role !== 'admin') {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/admin" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetails />} />
              <Route path="projects/:id/edit" element={<EditProject />} />
              <Route path="kyc" element={<KYC />} />
              <Route path="investments" element={<InvestmentRecords />} />
              <Route path="payments" element={<Payments />} />
              <Route path="withdrawals" element={<Withdrawals />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="logs" element={<Logs />} />
              <Route path="support" element={<CustomerSupport />} />
            </Route>

            <Route path="/" element={<Navigate to="/admin/dashboard" />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
