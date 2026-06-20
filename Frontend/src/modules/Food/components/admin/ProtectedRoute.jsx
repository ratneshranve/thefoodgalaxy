import { useState, useEffect } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@food/utils/auth"
import { adminSidebarMenu } from "../../utils/adminSidebarMenu.js"

// Flatten menu to map paths to required permissions
const buildPathPermissions = () => {
  const map = []; // { path: string, permissions: string[] }
  
  adminSidebarMenu.forEach(item => {
    if (item.type === "link") {
      map.push({ path: item.path, permissions: [item.label] });
    } else if (item.type === "expandable") {
      item.subItems?.forEach(sub => {
        map.push({ path: sub.path, permissions: [item.label, sub.label] });
      });
    } else if (item.type === "section") {
      item.items?.forEach(secItem => {
        if (secItem.type === "link") {
          map.push({ path: secItem.path, permissions: [secItem.label] });
        } else if (secItem.type === "expandable") {
          secItem.subItems?.forEach(sub => {
            map.push({ path: sub.path, permissions: [secItem.label, sub.label] });
          });
        }
      });
    }
  });
  
  // Sort by length descending so more specific paths match first
  return map.sort((a, b) => b.path.length - a.path.length);
}

const pathPermissions = buildPathPermissions();

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const isAuthenticated = isModuleAuthenticated("admin")

  const [adminUser, setAdminUser] = useState(() => {
    try {
      const str = localStorage.getItem('admin_user');
      return str ? JSON.parse(str) : null;
    } catch(e) {
      return null;
    }
  });

  useEffect(() => {
    const handleAuthChange = () => {
      try {
        const str = localStorage.getItem('admin_user');
        setAdminUser(str ? JSON.parse(str) : null);
      } catch(e) {
        // ignore
      }
    };
    window.addEventListener('adminAuthChanged', handleAuthChange);
    return () => window.removeEventListener('adminAuthChanged', handleAuthChange);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }

  // Check sub admin access
  try {
    if (adminUser && adminUser?.role === 'SUB_ADMIN') {
      const allowed = adminUser.accessibleModules || [];
      
      // Find matching path configuration
      const match = pathPermissions.find(p => location.pathname === p.path || location.pathname.startsWith(p.path + '/'));
      
      if (match) {
        // Check if user has AT LEAST ONE of the required permissions
        const hasAccess = match.permissions.some(perm => allowed.includes(perm));
        if (!hasAccess) {
            const firstAllowed = pathPermissions.find(p => p.permissions.some(perm => allowed.includes(perm)));
            if (firstAllowed && firstAllowed.path !== location.pathname) {
              return <Navigate to={firstAllowed.path} replace />
            } else {
              return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100">
                  <div className="text-center p-8 bg-white rounded-lg shadow-md">
                    <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
                    <p className="text-gray-600">You do not have permission to view this page.</p>
                  </div>
                </div>
              )
            }
        }
      }
    }
  } catch(e) {
    console.error("Access check error", e);
  }

  return children
}
