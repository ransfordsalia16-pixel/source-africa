import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Guards a role's dashboard. If nobody is signed in, or the wrong persona is
// signed in, it sends the visitor back to the welcome screen rather than
// silently showing another role's data. This is the front end half of the
// role based access control described in the platform's security model.
export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, role: activeRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  if (role && activeRole !== role) {
    return <Navigate to={`/${activeRole}`} replace />;
  }
  return children;
}
