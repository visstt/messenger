import { NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { adminApi } from "./adminApi";
import layoutStyles from "./AdminLayout.module.css";
import shared from "./shared.module.css";

export default function AdminLayout({ admin, onLogout }) {
  const navigate = useNavigate();
  const isChatView = Boolean(useMatch("/chats/:chatId"));

  async function handleLogout() {
    try {
      await adminApi.logout();
    } catch {
      // ignore
    }
    onLogout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={layoutStyles.layout}>
      <aside className={layoutStyles.sidebar}>
        <div className={layoutStyles.brandBlock}>
          <div className={layoutStyles.brand}>Messenger Admin</div>
          <div className={layoutStyles.brandUser}>{admin?.username}</div>
        </div>
        <nav className={layoutStyles.nav} aria-label="Навигация">
          <NavLink
            to="/users"
            className={({ isActive }) =>
              isActive ? layoutStyles.navLinkActive : layoutStyles.navLink
            }
          >
            Пользователи
          </NavLink>
        </nav>
        <button
          type="button"
          className={`${shared.btnSecondary} ${layoutStyles.logout}`}
          onClick={handleLogout}
        >
          Выйти
        </button>
      </aside>
      <main className={isChatView ? layoutStyles.mainChat : layoutStyles.main}>
        <Outlet />
      </main>
    </div>
  );
}
