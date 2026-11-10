package config

import (
	"errors"
	"os"
	"strings"
	"time"
)

const (
	defaultHTTPAddress     = ":8080"
	defaultShutdownTimeout = 10 * time.Second
)

type Config struct {
	HTTPAddress     string
	DatabaseURL     string
	ShutdownTimeout time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		HTTPAddress:     strings.TrimSpace(os.Getenv("LOTUSLEARN_GOVERNANCE_HTTP_ADDR")),
		DatabaseURL:     strings.TrimSpace(os.Getenv("LOTUSLEARN_DATABASE_URL")),
		ShutdownTimeout: defaultShutdownTimeout,
	}

	if cfg.HTTPAddress == "" {
		cfg.HTTPAddress = defaultHTTPAddress
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("LOTUSLEARN_DATABASE_URL is required")
	}

	return cfg, nil
}
