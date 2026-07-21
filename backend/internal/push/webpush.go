package push

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"

	webpush "github.com/SherClockHolmes/webpush-go"

	"messenger/backend/internal/store"
)

// Service управляет Web Push уведомлениями.
type Service struct {
	store      *store.Store
	vapidPub   string
	vapidPriv  string
	contactURL string // mailto: или https: для VAPID sub
}

func New(st *store.Store, vapidPublicKey, vapidPrivateKey, appOrigin string) *Service {
	contact := "mailto:admin@example.com"
	if strings.HasPrefix(appOrigin, "http") {
		contact = appOrigin
	}
	return &Service{
		store:      st,
		vapidPub:   vapidPublicKey,
		vapidPriv:  vapidPrivateKey,
		contactURL: contact,
	}
}

// Enabled возвращает true если VAPID ключи настроены.
func (s *Service) Enabled() bool {
	return strings.TrimSpace(s.vapidPub) != "" && strings.TrimSpace(s.vapidPriv) != ""
}

// PublicKey возвращает VAPID публичный ключ для передачи клиенту.
func (s *Service) PublicKey() string {
	return s.vapidPub
}

// NotifyPayload — тело push-уведомления.
type NotifyPayload struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	ChatID int64  `json:"chatId,omitempty"`
	URL    string `json:"url,omitempty"`
}

// SendToUsers отправляет push-уведомление всем подпискам указанных пользователей.
// Отправка идёт параллельно, ошибки логируются (не фатальны).
func (s *Service) SendToUsers(ctx context.Context, userIDs []int64, payload NotifyPayload) {
	if !s.Enabled() {
		return
	}
	if len(userIDs) == 0 {
		return
	}

	subs, err := s.store.GetPushSubscriptionsByUserIDs(ctx, userIDs)
	if err != nil {
		log.Printf("[push] failed to get subscriptions: %v", err)
		return
	}
	if len(subs) == 0 {
		return
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[push] json marshal error: %v", err)
		return
	}

	var wg sync.WaitGroup
	for _, sub := range subs {
		sub := sub
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.sendOne(ctx, sub, data)
		}()
	}
	wg.Wait()
}

func (s *Service) sendOne(ctx context.Context, sub store.PushSubscription, payload []byte) {
	subscription := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256dh,
			Auth:   sub.Auth,
		},
	}

	resp, err := webpush.SendNotificationWithContext(ctx, payload, subscription, &webpush.Options{
		VAPIDPublicKey:  s.vapidPub,
		VAPIDPrivateKey: s.vapidPriv,
		Subscriber:      s.contactURL,
		TTL:             60,
	})
	if err != nil {
		log.Printf("[push] send error for endpoint %s: %v", sub.Endpoint, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 410 || resp.StatusCode == 404 {
		// Подписка устарела — удаляем
		log.Printf("[push] subscription expired (status %d), removing endpoint %s", resp.StatusCode, sub.Endpoint)
		_ = s.store.DeletePushSubscription(context.Background(), sub.UserID, sub.Endpoint)
	} else if resp.StatusCode >= 400 {
		log.Printf("[push] push server returned %d for endpoint %s", resp.StatusCode, sub.Endpoint)
	}
}
