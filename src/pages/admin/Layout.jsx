import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { FileText, HelpCircle, BarChart2, LogOut, ChevronLeft } from "lucide-react";
import { useAuth } from "../../App";

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="admin-shell">
      <nav className="admin-sidebar">
        <div className="admin-logo">
          <span>Admin Panel</span>
        </div>
        <NavLink to="/admin/exams" className={({ isActive }) => `admin-nav-item${isActive ? " active" : ""}`}>
          <FileText size={16} /> <span>Exams</span>
        </NavLink>
        <NavLink to="/admin/questions" className={({ isActive }) => `admin-nav-item${isActive ? " active" : ""}`}>
          <HelpCircle size={16} /> <span>Question bank</span>
        </NavLink>
        <div style={{ flex: 1 }} />
        <button className="admin-nav-item" onClick={() => navigate("/dashboard")}>
          <ChevronLeft size={16} /> <span>Candidate view</span>
        </button>
        <button className="admin-nav-item" onClick={logout}>
          <LogOut size={16} /> <span>Log out</span>
        </button>
      </nav>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
