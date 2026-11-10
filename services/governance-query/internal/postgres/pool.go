package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMaxConns              int32 = 10
	defaultMinIdleConns          int32 = 1
	defaultMaxConnLifetime             = time.Hour
	defaultMaxConnLifetimeJitter       = 5 * time.Minute
	defaultMaxConnIdleTime             = 30 * time.Minute
	defaultHealthCheckPeriod           = time.Minute
	defaultPingTimeout                 = 5 * time.Second
)

func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if ctx == nil {
		return nil, errors.New("context is required")
	}

	databaseURL = strings.TrimSpace(databaseURL)
	if databaseURL == "" {
		return nil, errors.New("database URL is required")
	}

	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse PostgreSQL pool configuration: %w", err)
	}

	cfg.MaxConns = defaultMaxConns
	cfg.MinConns = 0
	cfg.MinIdleConns = defaultMinIdleConns
	cfg.MaxConnLifetime = defaultMaxConnLifetime
	cfg.MaxConnLifetimeJitter = defaultMaxConnLifetimeJitter
	cfg.MaxConnIdleTime = defaultMaxConnIdleTime
	cfg.HealthCheckPeriod = defaultHealthCheckPeriod
	cfg.PingTimeout = defaultPingTimeout

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create PostgreSQL pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, defaultPingTimeout)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping PostgreSQL: %w", err)
	}

	return pool, nil
}
