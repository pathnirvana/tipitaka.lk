package main

// The country of an IP address, from DB-IP's "IP to Country Lite" database (CC BY 4.0, https://db-ip.com; a
// csv.gz of address ranges, ~4.5 MB, ~9 MB in memory). scripts/deploy.sh downloads the month's file. Used for the
// country of the statistics (stats.go). Nothing is sent to other services and no address is stored. (tipitaka.app)

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"sort"
	"strings"
)

type geoDB struct {
	v4  []uint32 // range starts, ascending (the ranges cover the whole space, unknown ones as ZZ)
	v4c [][2]byte
	v6  [][16]byte
	v6c [][2]byte
}

// loadGeo reads a DB-IP country csv (start,end,country), gzipped when it ends in .gz.
func loadGeo(path string) (*geoDB, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var rd io.Reader = f
	if strings.HasSuffix(path, ".gz") {
		gz, err := gzip.NewReader(f)
		if err != nil {
			return nil, err
		}
		rd = gz
	}
	g := &geoDB{}
	sc := bufio.NewScanner(rd)
	for sc.Scan() {
		start, rest, _ := strings.Cut(sc.Text(), ",")
		_, cc, _ := strings.Cut(rest, ",")
		ip, err := netip.ParseAddr(start)
		if err != nil || len(cc) != 2 {
			continue
		}
		c := [2]byte{cc[0], cc[1]}
		if ip.Is4() {
			g.v4 = append(g.v4, binary.BigEndian.Uint32(ip.AsSlice()))
			g.v4c = append(g.v4c, c)
		} else {
			g.v6 = append(g.v6, ip.As16())
			g.v6c = append(g.v6c, c)
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	if len(g.v4) == 0 || !sort.SliceIsSorted(g.v4, func(i, j int) bool { return g.v4[i] < g.v4[j] }) ||
		!sort.SliceIsSorted(g.v6, func(i, j int) bool { return bytes.Compare(g.v6[i][:], g.v6[j][:]) < 0 }) {
		return nil, fmt.Errorf("%s: not a sorted DB-IP country csv", path)
	}
	return g, nil
}

// country is the ISO code of the address ("" unknown, private or no database).
func (g *geoDB) country(ip netip.Addr) string {
	if g == nil || !ip.IsValid() {
		return ""
	}
	ip = ip.Unmap()
	var c [2]byte
	if ip.Is4() {
		x := binary.BigEndian.Uint32(ip.AsSlice())
		i := sort.Search(len(g.v4), func(i int) bool { return g.v4[i] > x }) - 1
		if i < 0 {
			return ""
		}
		c = g.v4c[i]
	} else {
		a := ip.As16()
		i := sort.Search(len(g.v6), func(i int) bool { return bytes.Compare(g.v6[i][:], a[:]) > 0 }) - 1
		if i < 0 {
			return ""
		}
		c = g.v6c[i]
	}
	if c == [2]byte{'Z', 'Z'} {
		return ""
	}
	return string(c[:])
}

// clientIP is the visitor's address: nginx's X-Real-IP when the request comes through it (from this machine).
func clientIP(r *http.Request) netip.Addr {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip, _ := netip.ParseAddr(host)
	if ip.IsLoopback() {
		if real, err := netip.ParseAddr(strings.TrimSpace(r.Header.Get("X-Real-IP"))); err == nil {
			return real
		}
	}
	return ip
}
