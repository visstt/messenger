package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	AppOrigin   string
	UploadDir   string
}

func Load() Config {
	return Config{
		Port:        env("PORT", "8080"),
		DatabaseURL: env("DATABASE_URL", "postgres://messenger:messenger@localhost:5432/messenger?sslmode=disable"),
		JWTSecret:   env("JWT_SECRET", "dev-secret-change-me"),
		AppOrigin:   env("APP_ORIGIN", "http://localhost:3000"),
		UploadDir:   env("UPLOAD_DIR", "./uploads"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
