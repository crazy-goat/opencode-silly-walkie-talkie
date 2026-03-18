package main

import (
	"crypto/tls"
	"flag"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":3000", "listen address")
	certFile := flag.String("cert", "/etc/walkie-tls/cert.pem", "TLS cert")
	keyFile := flag.String("key", "/etc/walkie-tls/key.pem", "TLS key")
	staticDir := flag.String("static", "/app/webui", "static files dir")
	flag.Parse()

	hub := NewHub()
	go hub.Run()

	mux := http.NewServeMux()
	mux.Handle("/api/sessions/ws", hub)
	mux.HandleFunc("/api/register", hub.HandleRegister)
	mux.HandleFunc("/ws/", HandleProxy)
	mux.Handle("/", http.FileServer(http.Dir(*staticDir)))

	cert, err := tls.LoadX509KeyPair(*certFile, *keyFile)
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
