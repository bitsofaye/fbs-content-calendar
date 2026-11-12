import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useClients } from './api/hooks';
import { homeClient } from './lib/workspace';
import Layout from './components/Layout';
import { FullPageSpinner } from './components/ui';
import Login from './pages/Login';
import AdminOverview from './pages/AdminOverview';
import ApprovalsPage from './pages/ApprovalsPage';
import ClientOverview from './pages/client/ClientOverview';
import ClientApprovals from './pages/client/ClientApprovals';
import ClientResults from './pages/client/ClientResults';
import ClientDashboard from './pages/ClientDashboard';
import ClientsPage from './pages/admin/ClientsPage';
import PillarsPage from './pages/admin/PillarsPage';
import UsersPage from './pages/admin/UsersPage';
import ImportPage from './pages/admin/ImportPage';
import AccountPage from './pages/AccountPage';

function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  // remember where they were going (e.g. a link to a post waiting for approval) and come back after sign-in
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

// FBS team lands on FBS's own calendar; the all-clients Overview is one click away
function AdminHome() {
  const { data: clients, isLoading } = useClients();
  if (isLoading || !clients) return <FullPageSpinner />;
  const home = homeClient(clients);
  return <Navigate to={home ? `/c/${home.slug}` : '/admin'} replace />;
}

function Home() {
  const { user } = useAuth();
  if (user.role === 'ADMIN') return <AdminHome />;
  if (user.client) return <Navigate to="/overview" replace />;
  return <div className="p-8 text-slate-600">Your account is not linked to a client yet. Please contact FBS.</div>;
}

// Client-only pages: admins are sent to their own overview, unlinked client logins to Home's message
function ClientOnly({ children }) {
  const { user } = useAuth();
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (!user.client) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route path="c/:slug" element={<ClientDashboard />} />
        <Route path="c/:slug/results" element={<ClientResults />} />
        <Route path="overview" element={<ClientOnly><ClientOverview /></ClientOnly>} />
        <Route path="approvals" element={<ClientOnly><ClientApprovals /></ClientOnly>} />
        <Route path="results" element={<ClientOnly><ClientResults /></ClientOnly>} />
        <Route path="account" element={<AccountPage />} />
        <Route path="admin" element={<Protected admin><AdminOverview /></Protected>} />
        <Route path="admin/approvals" element={<Protected admin><ApprovalsPage /></Protected>} />
        <Route path="admin/clients" element={<Protected admin><ClientsPage /></Protected>} />
        <Route path="admin/pillars" element={<Protected admin><PillarsPage /></Protected>} />
        <Route path="admin/users" element={<Protected admin><UsersPage /></Protected>} />
        <Route path="admin/import" element={<Protected admin><ImportPage /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
