package domain

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func validDecision() GovernanceDecision {
	const shaA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const shaB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	const shaC = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	const shaD = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

	return GovernanceDecision{
		ComparisonID:                 shaA,
		PolicyID:                     "metadata-governance",
		PolicyVersion:                "1",
		DecisionID:                   shaB,
		Status:                       GovernanceStatusPass,
		BaselineChecksum:             shaC,
		CurrentChecksum:              shaD,
		ChangeCount:                  2,
		BreakingChangeCount:          0,
		ReviewRequiredChangeCount:    0,
		NonBreakingChangeCount:       1,
		MetadataOnlyChangeCount:      1,
		DirectlyChangedAssetCount:    2,
		DownstreamImpactedAssetCount: 3,
		ViolationCount:               0,
		Payload:                      json.RawMessage(`{"source":"test"}`),
		RecordedAt:                   time.Date(2026, 11, 10, 4, 0, 0, 0, time.UTC),
	}
}

func TestGovernanceDecisionValidateAcceptsValidDecision(t *testing.T) {
	decision := validDecision()

	if err := decision.Validate(); err != nil {
		t.Fatalf("Validate() returned unexpected error: %v", err)
	}
}

func TestGovernanceDecisionValidateRejectsInvalidStatus(t *testing.T) {
	decision := validDecision()
	decision.Status = GovernanceStatus("UNKNOWN")

	err := decision.Validate()
	if err == nil {
		t.Fatal("Validate() expected error, got nil")
	}

	if !strings.Contains(err.Error(), "invalid governance status") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGovernanceDecisionValidateRejectsNegativeCount(t *testing.T) {
	decision := validDecision()
	decision.BreakingChangeCount = -1

	err := decision.Validate()
	if err == nil {
		t.Fatal("Validate() expected error, got nil")
	}

	if !strings.Contains(err.Error(), "breaking_change_count") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGovernanceDecisionValidateRejectsNonObjectPayload(t *testing.T) {
	decision := validDecision()
	decision.Payload = json.RawMessage(`[]`)

	err := decision.Validate()
	if err == nil {
		t.Fatal("Validate() expected error, got nil")
	}

	if !strings.Contains(err.Error(), "JSON object") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDecisionIdentityValidateRejectsInvalidComparisonID(t *testing.T) {
	identity := DecisionIdentity{
		ComparisonID:  "not-a-sha256",
		PolicyID:      "metadata-governance",
		PolicyVersion: "1",
	}

	if err := identity.Validate(); err == nil {
		t.Fatal("Validate() expected error, got nil")
	}
}
