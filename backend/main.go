package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"messenger/backend/internal/config"
	"messenger/backend/internal/db"
	"messenger/backend/internal/httpapi"
	"messenger/backend/internal/realtime"
	"messenger/backend/internal/storage"
	"messenger/backend/internal/store"
)

func main() {
	cfg := config.Load()

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("create upload dir: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	st := store.New(pool)
	if err := st.Migrate(ctx); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	if err := st.SeedDemoData(ctx); err != nil {
		log.Fatalf("seed demo data: %v", err)
	}

	uploader, err := storage.NewUploader(ctx, cfg)
	if err != nil {
		log.Fatalf("configure storage: %v", err)
	}

	hub := realtime.NewHub()
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewServer(cfg, st, hub, uploader),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("messenger backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}
