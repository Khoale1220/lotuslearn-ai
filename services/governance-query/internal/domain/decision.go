package domain

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type GovernanceStatus string

const (
	GovernanceStatusPass   GovernanceStatus = "PASS"
	GovernanceStatusReview GovernanceStatus = "REVIEW"
	GovernanceStatusBlock  GovernanceStatus = "BLOCK"
)

func (s GovernanceStatus) Valid() bool {
	switch s {
	case GovernanceStatusPass, GovernanceStatusReview, GovernanceStatusBlock:
		return true
	default:
		return false
	}
}

type DecisionIdentity struct {
	ComparisonID  string
	PolicyID      string
	PolicyVersion string
}

func (i DecisionIdentity) Validate() error {
	if !isLowerHex64(i.ComparisonID) {
		return errors.New("comparison_id must be a 64-character lowercase hexadecimal SHA-256")
	}

	if strings.TrimSpace(i.PolicyID) == "" {
		return errors.New("policy_id is required")
	}

	if strings.TrimSpace(i.PolicyVersion) == "" {
		return errors.New("policy_version is required")
	}

	return nil
}

type GovernanceDecision struct {
	ComparisonID                 string           `json:"comparison_id"`
	PolicyID                     string           `json:"policy_id"`
	PolicyVersion                string           `json:"policy_version"`
	DecisionID                   string           `json:"decision_id"`
	Status                       GovernanceStatus `json:"status"`
	BaselineChecksum             string           `json:"baseline_checksum"`
	CurrentChecksum              string           `json:"current_checksum"`
	ChangeCount                  int32            `json:"change_count"`
	BreakingChangeCount          int32            `json:"breaking_change_count"`
	ReviewRequiredChangeCount    int32            `json:"review_required_change_count"`
	NonBreakingChangeCount       int32            `json:"non_breaking_change_count"`
	MetadataOnlyChangeCount      int32            `json:"metadata_only_change_count"`
	DirectlyChangedAssetCount    int32            `json:"directly_changed_asset_count"`
	DownstreamImpactedAssetCount int32            `json:"downstream_impacted_asset_count"`
	ViolationCount               int32            `json:"violation_count"`
	Payload                      json.RawMessage  `json:"payload"`
	RecordedAt                   time.Time        `json:"recorded_at"`
}

func (d GovernanceDecision) Identity() DecisionIdentity {
	return DecisionIdentity{
		ComparisonID:  d.ComparisonID,
		PolicyID:      d.PolicyID,
		PolicyVersion: d.PolicyVersion,
	}
}

func (d GovernanceDecision) Validate() error {
	if err := d.Identity().Validate(); err != nil {
		return fmt.Errorf("identity: %w", err)
	}

	if !isLowerHex64(d.DecisionID) {
		return errors.New("decision_id must be a 64-character lowercase hexadecimal SHA-256")
	}

	if !d.Status.Valid() {
		return fmt.Errorf("invalid governance status %q", d.Status)
	}

	if !isLowerHex64(d.BaselineChecksum) {
		return errors.New("baseline_checksum must be a 64-character lowercase hexadecimal SHA-256")
	}

	if !isLowerHex64(d.CurrentChecksum) {
		return errors.New("current_checksum must be a 64-character lowercase hexadecimal SHA-256")
	}

	counts := []struct {
		name  string
		value int32
	}{
		{"change_count", d.ChangeCount},
		{"breaking_change_count", d.BreakingChangeCount},
		{"review_required_change_count", d.ReviewRequiredChangeCount},
		{"non_breaking_change_count", d.NonBreakingChangeCount},
		{"metadata_only_change_count", d.MetadataOnlyChangeCount},
		{"directly_changed_asset_count", d.DirectlyChangedAssetCount},
		{"downstream_impacted_asset_count", d.DownstreamImpactedAssetCount},
		{"violation_count", d.ViolationCount},
	}

	for _, count := range counts {
		if count.value < 0 {
			return fmt.Errorf("%s must be non-negative", count.name)
		}
	}

	expectedChangeCount := d.BreakingChangeCount +
		d.ReviewRequiredChangeCount +
		d.NonBreakingChangeCount +
		d.MetadataOnlyChangeCount

	if d.ChangeCount != expectedChangeCount {
		return fmt.Errorf(
			"change_count must equal the sum of categorized change counts: got %d, expected %d",
			d.ChangeCount,
			expectedChangeCount,
		)
	}

	expectedViolationCount := d.BreakingChangeCount +
		d.ReviewRequiredChangeCount

	if d.ViolationCount != expectedViolationCount {
		return fmt.Errorf(
			"violation_count must equal breaking_change_count + review_required_change_count: got %d, expected %d",
			d.ViolationCount,
			expectedViolationCount,
		)
	}

	switch d.Status {
	case GovernanceStatusPass:
		if d.ViolationCount != 0 {
			return errors.New("PASS status requires violation_count to be zero")
		}
	case GovernanceStatusReview:
		if d.ViolationCount == 0 {
			return errors.New("REVIEW status requires violation_count to be greater than zero")
		}
	case GovernanceStatusBlock:
		if d.ViolationCount == 0 {
			return errors.New("BLOCK status requires violation_count to be greater than zero")
		}
	}

	if len(d.Payload) == 0 || !json.Valid(d.Payload) {
		return errors.New("payload must contain valid JSON")
	}

	var payloadObject map[string]json.RawMessage
	if err := json.Unmarshal(d.Payload, &payloadObject); err != nil || payloadObject == nil {
		return errors.New("payload must be a JSON object")
	}

	if d.RecordedAt.IsZero() {
		return errors.New("recorded_at is required")
	}

	return nil
}

func isLowerHex64(value string) bool {
	if len(value) != 64 {
		return false
	}

	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return false
		}
	}

	return true
}
