package main

import (
	"crypto/tls"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	home, _ := os.UserHomeDir()
	addr := flag.String("addr", ":3000", "listen address")
	certFile := flag.String("cert", filepath.Join(home, ".config/opencode/walkie-tls/cert.pem"), "TLS cert")
	keyFile := flag.String("key", filepath.Join(home, ".config/opencode/walkie-tls/key.pem"), "TLS key")
	staticDir := flag.String("static", "/app/webui", "static files dir")
	flag.Parse()

	hub := NewHub()
	go hub.Run()

	mux := http.NewServeMux()
	mux.Handle("/api/sessions/ws", hub)
	mux.HandleFunc("/api/sessions", hub.HandleList)
	mux.HandleFunc("/api/register", hub.HandleRegister)
	mux.HandleFunc("/ws/", HandleProxy)
	mux.Handle("/", http.FileServer(http.Dir(*staticDir)))

	cert, err := ensureTLSCert(*certFile, *keyFile)
	if err != nil {
		log.Fatalf("TLS: %v", err)
	}

	srv := &http.Server{
		Addr:      *addr,
		Handler:   mux,
		TLSConfig: &tls.Config{Certificates: []tls.Certificate{cert}},
	}

	log.Printf("Listening on %s", *addr)
	log.Fatal(srv.ListenAndServeTLS("", ""))
}
