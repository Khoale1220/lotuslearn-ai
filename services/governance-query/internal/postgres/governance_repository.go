package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/Khoale1220/lotuslearn-ai/services/governance-query/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultDecisionPageSize = 50
	maxDecisionPageSize     = 200
)

const decisionColumns = `
	comparison_id,
	policy_id,
	policy_version,
	decision_id,
	status,
	baseline_checksum,
	current_checksum,
	change_count,
	breaking_change_count,
	review_required_change_count,
	non_breaking_change_count,
	metadata_only_change_count,
	directly_changed_asset_count,
	downstream_impacted_asset_count,
	violation_count,
	payload_json,
	recorded_at
`

const getDecisionSQL = `
SELECT
` + decisionColumns + `
FROM public.metadata_governance_decision_history
WHERE comparison_id = $1
  AND policy_id = $2
  AND policy_version = $3
`

const listRecentDecisionsSQL = `
SELECT
` + decisionColumns + `
FROM public.metadata_governance_decision_history
ORDER BY recorded_at DESC, decision_id DESC
LIMIT $1
`

type queryer interface {
	Query(
		ctx context.Context,
		sql string,
		args ...any,
	) (pgx.Rows, error)

	QueryRow(
		ctx context.Context,
		sql string,
		args ...any,
	) pgx.Row
}

type rowScanner interface {
	Scan(dest ...any) error
}

type DecisionRepository struct {
	db queryer
}

func NewDecisionRepository(
	pool *pgxpool.Pool,
) (*DecisionRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres pool is required")
	}

	return &DecisionRepository{
		db: pool,
	}, nil
}

func newDecisionRepository(
	db queryer,
) (*DecisionRepository, error) {
	if db == nil {
		return nil, errors.New("postgres queryer is required")
	}

	return &DecisionRepository{
		db: db,
	}, nil
}

func (r *DecisionRepository) Get(
	ctx context.Context,
	identity domain.DecisionIdentity,
) (domain.GovernanceDecision, bool, error) {
	if err := identity.Validate(); err != nil {
		return domain.GovernanceDecision{}, false,
			fmt.Errorf("validate governance decision identity: %w", err)
	}

	decision, err := scanDecision(
		r.db.QueryRow(
			ctx,
			getDecisionSQL,
			identity.ComparisonID,
			identity.PolicyID,
			identity.PolicyVersion,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.GovernanceDecision{}, false, nil
	}
	if err != nil {
		return domain.GovernanceDecision{}, false,
			fmt.Errorf("query governance decision: %w", err)
	}

	return decision, true, nil
}

func (r *DecisionRepository) ListRecent(
	ctx context.Context,
	limit int,
) ([]domain.GovernanceDecision, error) {
	normalizedLimit, err := normalizeDecisionLimit(limit)
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(
		ctx,
		listRecentDecisionsSQL,
		normalizedLimit,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"query recent governance decisions: %w",
			err,
		)
	}
	defer rows.Close()

	decisions := make(
		[]domain.GovernanceDecision,
		0,
		normalizedLimit,
	)

	for rows.Next() {
		decision, scanErr := scanDecision(rows)
		if scanErr != nil {
			return nil, fmt.Errorf(
				"scan recent governance decision: %w",
				scanErr,
			)
		}

		decisions = append(decisions, decision)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"iterate recent governance decisions: %w",
			err,
		)
	}

	return decisions, nil
}

func normalizeDecisionLimit(limit int) (int, error) {
	switch {
	case limit == 0:
		return defaultDecisionPageSize, nil

	case limit < 0:
		return 0, errors.New(
			"governance decision limit must be positive",
		)

	case limit > maxDecisionPageSize:
		return 0, fmt.Errorf(
			"governance decision limit must not exceed %d",
			maxDecisionPageSize,
		)

	default:
		return limit, nil
	}
}

func scanDecision(
	row rowScanner,
) (domain.GovernanceDecision, error) {
	var decision domain.GovernanceDecision
	var status string
	var payload []byte

	err := row.Scan(
		&decision.ComparisonID,
		&decision.PolicyID,
		&decision.PolicyVersion,
		&decision.DecisionID,
		&status,
		&decision.BaselineChecksum,
		&decision.CurrentChecksum,
		&decision.ChangeCount,
		&decision.BreakingChangeCount,
		&decision.ReviewRequiredChangeCount,
		&decision.NonBreakingChangeCount,
		&decision.MetadataOnlyChangeCount,
		&decision.DirectlyChangedAssetCount,
		&decision.DownstreamImpactedAssetCount,
		&decision.ViolationCount,
		&payload,
		&decision.RecordedAt,
	)
	if err != nil {
		return domain.GovernanceDecision{}, err
	}

	decision.Status = domain.GovernanceStatus(status)
	decision.Payload = append(
		json.RawMessage(nil),
		payload...,
	)

	if err := decision.Validate(); err != nil {
		return domain.GovernanceDecision{},
			fmt.Errorf(
				"persisted governance decision violates domain contract: %w",
				err,
			)
	}

	return decision, nil
}
