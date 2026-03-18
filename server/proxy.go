package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"regexp"
)

var proxyPathRe = regexp.MustCompile(`^/ws/(\d+)(/.*)?\z`)

func HandleProxy(w http.ResponseWriter, r *http.Request) {
	m := proxyPathRe.FindStringSubmatch(r.URL.Path)
	if m == nil {
		http.NotFound(w, r)
		return
	}
	port := m[1]
	rest := m[2]
	if rest == "" {
		rest = "/"
	}

	backendAddr := fmt.Sprintf("127.0.0.1:%s", port)

	backendConn, err := tls.Dial("tcp", backendAddr, &tls.Config{InsecureSkipVerify: true})
	if err != nil {
		log.Printf("proxy: dial %s: %v", backendAddr, err)
		http.Error(w, "backend unavailable", http.StatusBadGateway)
		return
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		backendConn.Close()
		http.Error(w, "hijack not supported", http.StatusInternalServerError)
		return
	}
	clientConn, buf, err := hijacker.Hijack()
	if err != nil {
		backendConn.Close()
		http.Error(w, "hijack failed", http.StatusInternalServerError)
		return
	}

	r.URL.Path = rest
	r.URL.Host = backendAddr
	r.URL.Scheme = "wss"
	r.Host = backendAddr
	if err := r.Write(backendConn); err != nil {
		log.Printf("proxy: write request: %v", err)
		clientConn.Close()
		backendConn.Close()
		return
	}

	if buf.Reader.Buffered() > 0 {
		data := make([]byte, buf.Reader.Buffered())
		buf.Read(data)
		backendConn.Write(data)
	}

	log.Printf("proxy /ws/%s%s → tunneling", port, rest)

	done := make(chan struct{}, 2)
	pipe := func(dst net.Conn, src net.Conn) {
		io.Copy(dst, src)
		done <- struct{}{}
	}
	go pipe(backendConn, clientConn)
	go pipe(clientConn, backendConn)
	<-done

	clientConn.Close()
	backendConn.Close()
}
