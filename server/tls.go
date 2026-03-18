package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

func localIPs() []net.IP {
	ips := []net.IP{net.ParseIP("127.0.0.1")}
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			if ip4 := ip.To4(); ip4 != nil {
				ips = append(ips, ip4)
			}
		}
	}
	return ips
}

func ensureTLSCert(certFile, keyFile string) (tls.Certificate, error) {
	if _, err := os.Stat(certFile); err == nil {
		if _, err := os.Stat(keyFile); err == nil {
			return tls.LoadX509KeyPair(certFile, keyFile)
		}
	}

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return tls.Certificate{}, err
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "walkie-talkie-local"},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IPAddresses:  localIPs(),
		DNSNames:     []string{"localhost"},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}

	if err := os.MkdirAll(filepath.Dir(certFile), 0700); err != nil {
		return tls.Certificate{}, err
	}
	if err := os.MkdirAll(filepath.Dir(keyFile), 0700); err != nil {
		return tls.Certificate{}, err
	}

	cf, err := os.Create(certFile)
	if err != nil {
		return tls.Certificate{}, err
	}
	defer cf.Close()
	pem.Encode(cf, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	kf, err := os.OpenFile(keyFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return tls.Certificate{}, err
	}
	defer kf.Close()
	pem.Encode(kf, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})

	return tls.X509KeyPair(
		pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}),
		pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}),
	)
}
