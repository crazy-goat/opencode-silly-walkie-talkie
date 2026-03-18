package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

type Session struct {
	WsUrl     string    `json:"wsUrl"`
	SessionID string    `json:"sessionId,omitempty"`
	Title     string    `json:"title,omitempty"`
	lastSeen  time.Time `json:"-"`
}

type hubEvent struct {
	Type    string  `json:"type"`
	Session Session `json:"session"`
}

type Hub struct {
	mu       sync.RWMutex
	sessions map[string]Session
	clients  map[chan hubEvent]struct{}
}

func NewHub() *Hub {
	return &Hub{
		sessions: make(map[string]Session),
		clients:  make(map[chan hubEvent]struct{}),
	}
}

func (h *Hub) Run() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		h.evictStale(60 * time.Second)
	}
}

func (h *Hub) evictStale(ttl time.Duration) {
	h.mu.Lock()
	var stale []Session
	for key, s := range h.sessions {
		if time.Since(s.lastSeen) > ttl {
			stale = append(stale, s)
			delete(h.sessions, key)
		}
	}
	h.mu.Unlock()
	for _, s := range stale {
		log.Printf("evicted stale session: %s", s.WsUrl)
		h.broadcast(hubEvent{Type: "session.removed", Session: s})
	}
}

func (h *Hub) add(s Session) {
	h.mu.Lock()
	key := s.SessionID
	if key == "" {
		key = s.WsUrl
	}
	existing, exists := h.sessions[key]
	s.lastSeen = time.Now()
	h.sessions[key] = s
	h.mu.Unlock()
	if !exists || existing.WsUrl != s.WsUrl || existing.SessionID != s.SessionID || existing.Title != s.Title {
		h.broadcast(hubEvent{Type: "session.added", Session: s})
	}
}

func (h *Hub) remove(wsUrl string) {
	h.mu.Lock()
	var found *Session
	var foundKey string
	for k, s := range h.sessions {
		if s.WsUrl == wsUrl {
			found = &s
			foundKey = k
			break
		}
	}
	if found != nil {
		delete(h.sessions, foundKey)
	}
	h.mu.Unlock()
	if found != nil {
		h.broadcast(hubEvent{Type: "session.removed", Session: *found})
	}
}

func (h *Hub) broadcast(e hubEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- e:
		default:
		}
	}
}

func (h *Hub) subscribe() chan hubEvent {
	ch := make(chan hubEvent, 16)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *Hub) unsubscribe(ch chan hubEvent) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
}

func (h *Hub) HandleList(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	sessions := make([]Session, 0, len(h.sessions))
	for _, s := range h.sessions {
		sessions = append(sessions, s)
	}
	h.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func (h *Hub) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var s Session
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil || s.WsUrl == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodPost:
		h.add(s)
		log.Printf("registered: %s", s.WsUrl)
		w.WriteHeader(http.StatusOK)
	case http.MethodDelete:
		h.remove(s.WsUrl)
		log.Printf("unregistered: %s", s.WsUrl)
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		log.Printf("ws accept: %v", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	ch := h.subscribe()
	defer h.unsubscribe(ch)

	// Send current sessions snapshot
	h.mu.RLock()
	for _, s := range h.sessions {
		_ = wsjson.Write(context.Background(), conn, hubEvent{Type: "session.added", Session: s})
	}
	h.mu.RUnlock()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case e := <-ch:
			if err := wsjson.Write(ctx, conn, e); err != nil {
				return
			}
		}
	}
}
