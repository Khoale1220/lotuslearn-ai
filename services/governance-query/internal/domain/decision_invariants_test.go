package domain

import (
	"strings"
	"testing"
)

func validZeroViolationDecision() GovernanceDecision {
	d := validDecision()

	d.Status = GovernanceStatusPass
	d.ChangeCount = 0
	d.BreakingChangeCount = 0
	d.ReviewRequiredChangeCount = 0
	d.NonBreakingChangeCount = 0
	d.MetadataOnlyChangeCount = 0
	d.DirectlyChangedAssetCount = 0
	d.DownstreamImpactedAssetCount = 0
	d.ViolationCount = 0

	return d
}

func TestGovernanceDecisionValidateCrossFieldInvariants(t *testing.T) {
	tests := []struct {
		name        string
		mutate      func(*GovernanceDecision)
		wantMessage string
	}{
		{
			name: "change count must equal categorized total",
			mutate: func(d *GovernanceDecision) {
				d.ChangeCount = 1
			},
			wantMessage: "change_count must equal",
		},
		{
			name: "violation count must equal breaking plus review required",
			mutate: func(d *GovernanceDecision) {
				d.Status = GovernanceStatusReview
				d.ChangeCount = 1
				d.BreakingChangeCount = 1
				d.ViolationCount = 0
			},
			wantMessage: "violation_count must equal",
		},
		{
			name: "pass cannot contain violations",
			mutate: func(d *GovernanceDecision) {
				d.Status = GovernanceStatusPass
				d.ChangeCount = 1
				d.BreakingChangeCount = 1
				d.ViolationCount = 1
			},
			wantMessage: "PASS status requires",
		},
		{
			name: "review requires violations",
			mutate: func(d *GovernanceDecision) {
				d.Status = GovernanceStatusReview
			},
			wantMessage: "REVIEW status requires",
		},
		{
			name: "block requires violations",
			mutate: func(d *GovernanceDecision) {
				d.Status = GovernanceStatusBlock
			},
			wantMessage: "BLOCK status requires",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := validZeroViolationDecision()
			tt.mutate(&d)

			err := d.Validate()
			if err == nil {
				t.Fatal("Validate() returned nil, expected invariant violation")
			}

			if !strings.Contains(err.Error(), tt.wantMessage) {
				t.Fatalf(
					"Validate() error = %q, expected substring %q",
					err.Error(),
					tt.wantMessage,
				)
			}
		})
	}
}
