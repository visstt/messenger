import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "./adminApi";
import { formatRuPhoneInput } from "../utils/phoneMask";
import shared from "./shared.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminApi
      .listUsers(search)
      .then((data) => {
        if (!cancelled) setUsers(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Не удалось загрузить пользователей");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  function handleSearch(event) {
    event.preventDefault();
    setSearch(query.trim());
  }

  return (
    <div className={shared.page}>
      <div className={shared.pageHeader}>
        <h1>Пользователи</h1>
        <form className={shared.toolbar} onSubmit={handleSearch}>
          <input
            className={`${shared.input} ${shared.searchInput}`}
            placeholder="Поиск: имя, логин, email, телефон"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className={shared.btnSecondary}>
            Найти
          </button>
        </form>
      </div>

      {error ? <div className={shared.alertError}>{error}</div> : null}

      {loading ? (
        <p className={shared.muted}>Загрузка…</p>
      ) : (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Логин</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className={shared.muted}>
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>
                      <Link className={shared.tableLink} to={`/users/${user.id}`}>
                        {user.name}
                      </Link>
                    </td>
                    <td>{user.username}</td>
                    <td>{user.email || "—"}</td>
                    <td>{user.phone ? formatRuPhoneInput(user.phone) : "—"}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
