package realtime

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*websocket.Conn]struct{}
	writers map[*websocket.Conn]*sync.Mutex
}

type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[int64]map[*websocket.Conn]struct{}),
		writers: make(map[*websocket.Conn]*sync.Mutex),
	}
}

func (h *Hub) Register(userID int64, conn *websocket.Conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	conns, ok := h.clients[userID]
	wasOnline := ok && len(conns) > 0
	if !ok {
		h.clients[userID] = make(map[*websocket.Conn]struct{})
	}
	h.clients[userID][conn] = struct{}{}
	if _, exists := h.writers[conn]; !exists {
		h.writers[conn] = &sync.Mutex{}
	}
	return !wasOnline
}

func (h *Hub) Unregister(userID int64, conn *websocket.Conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	conns, ok := h.clients[userID]
	if !ok {
		delete(h.writers, conn)
		_ = conn.Close()
		return false
	}

	delete(conns, conn)
	delete(h.writers, conn)
	_ = conn.Close()
	if len(conns) > 0 {
		return false
	}

	delete(h.clients, userID)
	return true
}

func (h *Hub) BroadcastToUser(userID int64, event Event) {
	payload, err := json.Marshal(event)
	if err != nil {
		return
	}

	h.mu.RLock()
	targets := make([]struct {
		conn *websocket.Conn
		mu   *sync.Mutex
	}, 0, len(h.clients[userID]))
	for conn := range h.clients[userID] {
		mu, ok := h.writers[conn]
		if !ok {
			continue
		}
		targets = append(targets, struct {
			conn *websocket.Conn
			mu   *sync.Mutex
		}{conn: conn, mu: mu})
	}
	h.mu.RUnlock()

	for _, target := range targets {
		target.mu.Lock()
		err := target.conn.WriteMessage(websocket.TextMessage, payload)
		target.mu.Unlock()
		if err != nil {
			h.Unregister(userID, target.conn)
		}
	}
}

func (h *Hub) IsOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}
