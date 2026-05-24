package httpapi

import (
	"context"
	"net/http"

	"messenger/backend/internal/auth"
)

const adminIDKey contextKey = "adminID"

func (s *Server) adminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("messenger_admin_session")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		adminID, err := auth.ParseAdminToken(s.cfg.JWTSecret, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminIDKey, adminID)))
	})
}

func currentAdminID(ctx context.Context) int64 {
	adminID, _ := ctx.Value(adminIDKey).(int64)
	return adminID
}
