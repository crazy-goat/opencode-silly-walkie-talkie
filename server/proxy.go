package main

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
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

	target, _ := url.Parse(fmt.Sprintf("https://host.docker.internal:%s", port))
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	r.URL.Path = rest
	r.URL.Host = target.Host
	r.URL.Scheme = target.Scheme
	r.Host = target.Host

	proxy.ServeHTTP(w, r)
	log.Printf("proxy /ws/%s%s", port, rest)
}
