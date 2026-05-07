package realtime

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*websocket.Conn]struct{}
}

type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

func NewHub() *Hub {
	return &Hub{clients: make(map[int64]map[*websocket.Conn]struct{})}
}

func (h *Hub) Register(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[userID]; !ok {
		h.clients[userID] = make(map[*websocket.Conn]struct{})
	}
	h.clients[userID][conn] = struct{}{}
}

func (h *Hub) Unregister(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if conns, ok := h.clients[userID]; ok {
		delete(conns, conn)
		if len(conns) == 0 {
			delete(h.clients, userID)
		}
	}
	_ = conn.Close()
}

func (h *Hub) BroadcastToUser(userID int64, event Event) {
	h.mu.RLock()
	conns := h.clients[userID]
	h.mu.RUnlock()

	if len(conns) == 0 {
		return
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return
	}

	for conn := range conns {
		if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
			h.Unregister(userID, conn)
		}
	}
}

func (h *Hub) IsOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}
