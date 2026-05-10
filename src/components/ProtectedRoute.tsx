import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';


interface ProtectedRouteProps {
  requireApproved?: boolean;
  requireRoles?: UserRole[];
}

export const ProtectedRoute = ({ requireApproved = true, requireRoles }: ProtectedRouteProps) => {
  const { firebaseUser, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background z-[10000] fixed inset-0">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (firebaseUser && !userProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background z-[10000] fixed inset-0">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (userProfile?.status === 'rejected') {
    return <Navigate to="/login" state={{ error: 'Your account has been rejected.' }} replace />;
  }

  if (requireApproved && userProfile?.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (requireRoles && requireRoles.length > 0) {
    const roles = Array.isArray(userProfile?.role) ? userProfile.role : (userProfile?.role ? [userProfile.role] : []);
    const hasRole = roles.some((r: string) => requireRoles.includes(r as UserRole));
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
