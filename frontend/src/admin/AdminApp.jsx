import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import AdminLayout from "./AdminLayout";
import AdminLogin from "./AdminLogin";
import ChatMessagesPage from "./ChatMessagesPage";
import UserChatsPage from "./UserChatsPage";
import UserEditPage from "./UserEditPage";
import UsersPage from "./UsersPage";
import { adminApi } from "./adminApi";
import appStyles from "./AdminApp.module.css";

function AdminRoutes({ admin, setAdmin }) {
  const location = useLocation();

  if (!admin) {
    if (location.pathname === "/login") {
      return <AdminLogin onSuccess={setAdmin} />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <Routes>
      <Route
        element={<AdminLayout admin={admin} onLogout={() => setAdmin(null)} />}
      >
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UserEditPage />} />
        <Route path="users/:userId/chats" element={<UserChatsPage />} />
        <Route path="chats/:chatId" element={<ChatMessagesPage />} />
      </Route>
      <Route path="login" element={<Navigate to="/users" replace />} />
      <Route path="*" element={<Navigate to="/users" replace />} />
    </Routes>
  );
}

export default function AdminApp() {
  const [admin, setAdminState] = useState(null);
  const [booting, setBooting] = useState(true);

  const setAdmin = useCallback((value) => {
    setAdminState(value);
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .me()
      .then((data) => {
        if (!cancelled) setAdminState(data.admin);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return (
      <div className={appStyles.boot}>
        <p className={appStyles.bootText}>Загрузка…</p>
      </div>
    );
  }

  return (
    <div className={appStyles.root}>
      <BrowserRouter basename="/admin">
        <AdminRoutes admin={admin} setAdmin={setAdmin} />
      </BrowserRouter>
    </div>
  );
}
