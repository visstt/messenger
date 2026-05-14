package config

import (
	"os"
	"strings"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	AppOrigin        string
	CORSExtraOrigins string
	UploadDir        string
	S3Endpoint       string
	S3BucketName     string
	S3AccessKey      string
	S3SecretKey      string
	S3Region         string
	S3PublicURL      string
	LiveKitURL       string
	LiveKitPublicURL string
	LiveKitAPIKey    string
	LiveKitAPISecret string
}

func Load() Config {
	return Config{
		Port:             env("PORT", "8080"),
		DatabaseURL:      env("DATABASE_URL", "postgres://messenger:messenger@localhost:5432/messenger?sslmode=disable"),
		JWTSecret:        env("JWT_SECRET", "dev-secret-change-me"),
		AppOrigin:        env("APP_ORIGIN", "http://localhost:3000"),
		CORSExtraOrigins: env("CORS_EXTRA_ORIGINS", ""),
		UploadDir:        env("UPLOAD_DIR", "./uploads"),
		S3Endpoint:       env("S3_ENDPOINT", "https://s3.ru1.storage.beget.cloud"),
		S3BucketName:     env("S3_BUCKET_NAME", "c15b4d655f70-medvito-data"),
		S3AccessKey:      env("S3_ACCESS_KEY", "I6I3KOJ2YO3TN08TDJAI"),
		S3SecretKey:      env("S3_SECRET_KEY", "5up6F9kLNHRGmPIczdqAVZgBNgKhFpAGJ1JnCJUY"),
		S3Region:         env("S3_REGION", "ru1"),
		S3PublicURL:      env("S3_PUBLIC_URL", "https://s3.ru1.storage.beget.cloud"),
		LiveKitURL:       env("LIVEKIT_URL", "ws://localhost:7880"),
		LiveKitPublicURL: env("LIVEKIT_PUBLIC_URL", "ws://localhost:7880"),
		LiveKitAPIKey:    env("LIVEKIT_API_KEY", "devkey"),
		LiveKitAPISecret: env("LIVEKIT_API_SECRET", "secret"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// CorsAllowedOrigins объединяет APP_ORIGIN (несколько значений через запятую), CORS_EXTRA_ORIGINS и localhost для dev.
func CorsAllowedOrigins(cfg Config) []string {
	seen := make(map[string]struct{})
	var out []string
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		if _, ok := seen[s]; ok {
			return
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	for _, part := range strings.Split(cfg.AppOrigin, ",") {
		add(part)
	}
	for _, part := range strings.Split(cfg.CORSExtraOrigins, ",") {
		add(part)
	}
	add("http://localhost:3000")
	add("http://localhost:3020")
	return out
}
