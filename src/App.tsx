import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Asset from './pages/Asset';
import Equipment from './pages/Equipment';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ITForms from './pages/ITForms';
import Users from './pages/Users';
import Logs from './pages/Logs';
import FormBackend from './pages/FormBackend';

// Form Pages
import RepairRequest from './pages/forms/RepairRequest';
import Appointment from './pages/forms/Appointment';
import AssetRequest from './pages/forms/AssetRequest';
import AssetReturn from './pages/forms/AssetReturn';
import LicenseRequest from './pages/forms/LicenseRequest';
import UserRegistration from './pages/forms/UserRegistration';
import RemoteSupport from './pages/forms/RemoteSupport';

// Auth
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PendingApprovalPage from './pages/PendingApprovalPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Requires Login but can be pending */}
          <Route element={<ProtectedRoute requireApproved={false} />}>
            <Route path="/pending" element={<PendingApprovalPage />} />
          </Route>

          {/* Requires Login and Approved */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="asset" element={<Asset />} />
              <Route path="equipment" element={<Equipment />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="forms" element={<ITForms />} />
              <Route path="forms/001" element={<RepairRequest />} />
              <Route path="forms/002" element={<Appointment />} />
              <Route path="forms/003" element={<AssetRequest />} />
              <Route path="forms/004" element={<AssetReturn />} />
              <Route path="forms/005" element={<LicenseRequest />} />
              <Route path="forms/006" element={<UserRegistration />} />
              <Route path="forms/007" element={<RemoteSupport />} />
              <Route path="logs" element={<Logs />} />
              
              <Route path="users" element={<Users />} />
              <Route path="form-backend" element={<FormBackend />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
