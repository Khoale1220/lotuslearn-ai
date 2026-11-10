package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/Khoale1220/lotuslearn-ai/services/governance-query/internal/domain"
	"github.com/jackc/pgx/v5"
)

func TestNewDecisionRepositoryRejectsNilPool(
	t *testing.T,
) {
	t.Parallel()

	repository, err := NewDecisionRepository(nil)

	if err == nil {
		t.Fatal("expected error for nil PostgreSQL pool")
	}

	if repository != nil {
		t.Fatal("expected nil repository")
	}
}

func TestNormalizeDecisionLimit(
	t *testing.T,
) {
	t.Parallel()

	tests := []struct {
		name    string
		input   int
		want    int
		wantErr bool
	}{
		{
			name:  "default",
			input: 0,
			want:  defaultDecisionPageSize,
		},
		{
			name:  "minimum",
			input: 1,
			want:  1,
		},
		{
			name:  "maximum",
			input: maxDecisionPageSize,
			want:  maxDecisionPageSize,
		},
		{
			name:    "negative rejected",
			input:   -1,
			wantErr: true,
		},
		{
			name:    "above maximum rejected",
			input:   maxDecisionPageSize + 1,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt

		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := normalizeDecisionLimit(tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got != tt.want {
				t.Fatalf(
					"expected %d, got %d",
					tt.want,
					got,
				)
			}
		})
	}
}

func TestDecisionRepositoryGetRoundTripPostgres(
	t *testing.T,
) {
	databaseURL := os.Getenv(
		"LOTUSLEARN_TEST_DATABASE_URL",
	)
	if databaseURL == "" {
		t.Skip(
			"LOTUSLEARN_TEST_DATABASE_URL is not configured",
		)
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatalf(
			"connect to PostgreSQL test database: %v",
			err,
		)
	}
	defer conn.Close(context.Background())

	var databaseName string

	if err := conn.QueryRow(
		ctx,
		"SELECT current_database()",
	).Scan(&databaseName); err != nil {
		t.Fatalf(
			"read current database: %v",
			err,
		)
	}

	if databaseName != "lotuslearn_test" {
		t.Fatalf(
			"refusing integration test against database %q",
			databaseName,
		)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("begin transaction: %v", err)
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	repository, err := newDecisionRepository(tx)
	if err != nil {
		t.Fatalf(
			"construct transaction repository: %v",
			err,
		)
	}

	decision := domain.GovernanceDecision{
		ComparisonID: testSHA256(
			t.Name() + ":comparison",
		),
		PolicyID:      "governance-query-integration",
		PolicyVersion: "1",
		DecisionID: testSHA256(
			t.Name() + ":decision",
		),
		Status: domain.GovernanceStatusReview,
		BaselineChecksum: testSHA256(
			t.Name() + ":baseline",
		),
		CurrentChecksum: testSHA256(
			t.Name() + ":current",
		),
		ChangeCount:                  5,
		BreakingChangeCount:          1,
		ReviewRequiredChangeCount:    1,
		NonBreakingChangeCount:       2,
		MetadataOnlyChangeCount:      1,
		DirectlyChangedAssetCount:    2,
		DownstreamImpactedAssetCount: 3,
		ViolationCount:               2,
		Payload: json.RawMessage(
			`{"source":"governance-query-integration-test"}`,
		),
		RecordedAt: time.Now().
			UTC().
			Truncate(time.Microsecond),
	}

	if err := decision.Validate(); err != nil {
		t.Fatalf(
			"test fixture violates domain contract: %v",
			err,
		)
	}

	_, err = tx.Exec(
		ctx,
		`
INSERT INTO public.metadata_governance_decision_history (
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
)
VALUES (
	$1, $2, $3, $4, $5, $6, $7,
	$8, $9, $10, $11, $12, $13, $14,
	$15, $16::jsonb, $17
)
`,
		decision.ComparisonID,
		decision.PolicyID,
		decision.PolicyVersion,
		decision.DecisionID,
		string(decision.Status),
		decision.BaselineChecksum,
		decision.CurrentChecksum,
		decision.ChangeCount,
		decision.BreakingChangeCount,
		decision.ReviewRequiredChangeCount,
		decision.NonBreakingChangeCount,
		decision.MetadataOnlyChangeCount,
		decision.DirectlyChangedAssetCount,
		decision.DownstreamImpactedAssetCount,
		decision.ViolationCount,
		[]byte(decision.Payload),
		decision.RecordedAt,
	)
	if err != nil {
		t.Fatalf(
			"insert integration fixture: %v",
			err,
		)
	}

	got, found, err := repository.Get(
		ctx,
		decision.Identity(),
	)
	if err != nil {
		t.Fatalf(
			"repository Get returned error: %v",
			err,
		)
	}

	if !found {
		t.Fatal("expected persisted decision to be found")
	}

	assertDecisionEqual(
		t,
		decision,
		got,
	)
}

func assertDecisionEqual(
	t *testing.T,
	want domain.GovernanceDecision,
	got domain.GovernanceDecision,
) {
	t.Helper()

	if got.ComparisonID != want.ComparisonID {
		t.Fatalf(
			"comparison_id mismatch: want %q got %q",
			want.ComparisonID,
			got.ComparisonID,
		)
	}

	if got.PolicyID != want.PolicyID {
		t.Fatalf(
			"policy_id mismatch: want %q got %q",
			want.PolicyID,
			got.PolicyID,
		)
	}

	if got.PolicyVersion != want.PolicyVersion {
		t.Fatalf(
			"policy_version mismatch: want %q got %q",
			want.PolicyVersion,
			got.PolicyVersion,
		)
	}

	if got.DecisionID != want.DecisionID {
		t.Fatalf(
			"decision_id mismatch: want %q got %q",
			want.DecisionID,
			got.DecisionID,
		)
	}

	if got.Status != want.Status {
		t.Fatalf(
			"status mismatch: want %q got %q",
			want.Status,
			got.Status,
		)
	}

	if got.BaselineChecksum != want.BaselineChecksum {
		t.Fatal("baseline_checksum mismatch")
	}

	if got.CurrentChecksum != want.CurrentChecksum {
		t.Fatal("current_checksum mismatch")
	}

	if got.ChangeCount != want.ChangeCount {
		t.Fatal("change_count mismatch")
	}

	if got.BreakingChangeCount != want.BreakingChangeCount {
		t.Fatal("breaking_change_count mismatch")
	}

	if got.ReviewRequiredChangeCount !=
		want.ReviewRequiredChangeCount {
		t.Fatal("review_required_change_count mismatch")
	}

	if got.NonBreakingChangeCount !=
		want.NonBreakingChangeCount {
		t.Fatal("non_breaking_change_count mismatch")
	}

	if got.MetadataOnlyChangeCount !=
		want.MetadataOnlyChangeCount {
		t.Fatal("metadata_only_change_count mismatch")
	}

	if got.DirectlyChangedAssetCount !=
		want.DirectlyChangedAssetCount {
		t.Fatal("directly_changed_asset_count mismatch")
	}

	if got.DownstreamImpactedAssetCount !=
		want.DownstreamImpactedAssetCount {
		t.Fatal(
			"downstream_impacted_asset_count mismatch",
		)
	}

	if got.ViolationCount != want.ViolationCount {
		t.Fatal("violation_count mismatch")
	}

	var wantPayload any
	if err := json.Unmarshal(want.Payload, &wantPayload); err != nil {
		t.Fatalf("decode expected payload: %v", err)
	}

	var gotPayload any
	if err := json.Unmarshal(got.Payload, &gotPayload); err != nil {
		t.Fatalf("decode actual payload: %v", err)
	}

	wantCanonical, err := json.Marshal(wantPayload)
	if err != nil {
		t.Fatalf("canonicalize expected payload: %v", err)
	}

	gotCanonical, err := json.Marshal(gotPayload)
	if err != nil {
		t.Fatalf("canonicalize actual payload: %v", err)
	}

	if string(gotCanonical) != string(wantCanonical) {
		t.Fatalf(
			"payload mismatch: want %s got %s",
			wantCanonical,
			gotCanonical,
		)
	}

	if !got.RecordedAt.Equal(want.RecordedAt) {
		t.Fatalf(
			"recorded_at mismatch: want %s got %s",
			want.RecordedAt,
			got.RecordedAt,
		)
	}
}

func testSHA256(value string) string {
	sum := sha256.Sum256([]byte(value))

	return hex.EncodeToString(sum[:])
}
