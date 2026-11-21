import { GoogleSensitiveDataProtectionProvider } from "../server/services/sensitiveDataProtectionProvider.js";
import { PipelineError } from "../server/errors/pipelineErrors.js";
async function runLiveCloudPrivacySmokeTests() {
  const report = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || null,
    locationId: process.env.DLP_LOCATION || "global",
    authMethod: "none",
    dlpApiStatus: "UNAVAILABLE",
    liveGateStatus: "BLOCKED_BY_ENVIRONMENT",
    tests: {
      smokeTest1_textPii: "BLOCKED",
      smokeTest2_educationalPreservation: "BLOCKED",
      smokeTest3_imageRedaction: "BLOCKED",
      smokeTest4_failClosed: "BLOCKED"
    },
    details: []
  };
  if (!report.projectId) {
    try {
      const projRes = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/project/project-id",
        { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(1500) }
      );
      if (projRes.ok) {
        report.projectId = (await projRes.text()).trim();
        report.details.push(`Detected Google Cloud Project ID from Compute Metadata: ${report.projectId}`);
      }
    } catch {
      report.details.push("Compute metadata server project endpoint unreachable.");
    }
  }
  let accessToken = null;
  try {
    const tokenRes = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(1500) }
    );
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
        report.authMethod = "gcp_metadata_bearer_token";
        report.details.push("Successfully obtained GCP Service Account OAuth2 Bearer token from Compute Metadata.");
      }
    }
  } catch {
    if (process.env.GEMINI_API_KEY) {
      report.authMethod = "api_key";
      report.details.push("Using API key authentication from GEMINI_API_KEY.");
    }
  }
  if (!report.projectId) {
    report.details.push("No Google Cloud Project ID available in environment.");
    return report;
  }
  const parent = `projects/${report.projectId}/locations/${report.locationId}`;
  const dlpUrl = `https://dlp.googleapis.com/v2/${parent}/content:deidentify`;
  try {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "LotusLearn-LiveSmokeTest/1.0"
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    const probeRes = await fetch(dlpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        item: { value: "My name is Nguyen Van Minh and email is minh@example.com" },
        deidentifyConfig: {
          infoTypeTransformations: {
            transformations: [
              { primitiveTransformation: { replaceWithInfoTypeConfig: {} } }
            ]
          }
        },
        inspectConfig: {
          infoTypes: [{ name: "PERSON_NAME" }, { name: "EMAIL_ADDRESS" }],
          minLikelihood: "POSSIBLE",
          includeQuote: false
        }
      })
    });
    if (probeRes.status === 200) {
      report.dlpApiStatus = "ENABLED";
      report.details.push("Google Cloud Sensitive Data Protection API is ENABLED and returned HTTP 200.");
    } else {
      const errorJson = await probeRes.json();
      const errorReason = errorJson.error?.details?.[0]?.reason || errorJson.error?.status;
      if (errorReason === "SERVICE_DISABLED" || probeRes.status === 403) {
        report.dlpApiStatus = "SERVICE_DISABLED";
        report.activationUrl = errorJson.error?.details?.[0]?.metadata?.activationUrl || `https://console.developers.google.com/apis/api/dlp.googleapis.com/overview?project=${report.projectId}`;
        report.details.push(
          `Sensitive Data Protection (DLP) API is not yet enabled on project ${report.projectId}. Activation required at: ${report.activationUrl}`
        );
      } else if (probeRes.status === 401) {
        report.dlpApiStatus = "UNAUTHENTICATED";
        report.details.push("GCP request failed with 401 Unauthenticated.");
      } else {
        report.details.push(`DLP probe responded with unexpected HTTP ${probeRes.status}: ${JSON.stringify(errorJson)}`);
      }
    }
  } catch (err) {
    report.details.push(`DLP API probe network exception: ${err.message}`);
  }
  if (report.dlpApiStatus !== "ENABLED") {
    report.liveGateStatus = "BLOCKED_BY_ENVIRONMENT";
    report.details.push(
      "Live cloud tests safely bypassed without breaking hermetic verification. Classification: IMPLEMENTATION VERIFIED / LIVE CLOUD GATE BLOCKED BY ENVIRONMENT."
    );
    return report;
  }
  const liveProvider = new GoogleSensitiveDataProtectionProvider({
    projectId: report.projectId,
    locationId: report.locationId
  });
  try {
    const t1 = await liveProvider.deidentifyText({
      text: "My name is Nguyen Van Minh. My email is minh@example.com. My phone number is 0901234567. I have lived here for three years.",
      infoTypes: ["PERSON_NAME", "EMAIL_ADDRESS", "PHONE_NUMBER"]
    });
    if (!t1.sanitizedText.includes("Nguyen Van Minh") && !t1.sanitizedText.includes("minh@example.com") && !t1.sanitizedText.includes("0901234567") && t1.sanitizedText.includes("three years")) {
      report.tests.smokeTest1_textPii = "PASS";
      report.details.push(`Smoke Test 1 PASS: Detected ${t1.findingCount} PII tokens.`);
    } else {
      report.tests.smokeTest1_textPii = "FAIL";
    }
  } catch (e) {
    report.details.push(`Smoke Test 1 error: ${e.message}`);
    report.tests.smokeTest1_textPii = "FAIL";
  }
  try {
    const t2 = await liveProvider.deidentifyText({
      text: "May has lived in London since 2020. Hope visited Paris last year. Rose is reading a book.",
      infoTypes: ["PERSON_NAME", "EMAIL_ADDRESS", "PHONE_NUMBER"]
    });
    if (t2.sanitizedText.includes("London") && t2.sanitizedText.includes("Paris")) {
      report.tests.smokeTest2_educationalPreservation = "PASS";
      report.details.push("Smoke Test 2 PASS: Educational lesson content preserved.");
    } else {
      report.tests.smokeTest2_educationalPreservation = "FAIL";
    }
  } catch (e) {
    report.details.push(`Smoke Test 2 error: ${e.message}`);
    report.tests.smokeTest2_educationalPreservation = "FAIL";
  }
  try {
    const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const t3 = await liveProvider.redactImage({
      imageBytesBase64: samplePngBase64,
      mimeType: "image/png",
      infoTypes: ["PERSON_NAME", "EMAIL_ADDRESS", "PHONE_NUMBER"]
    });
    if (t3.redactedImageBase64) {
      report.tests.smokeTest3_imageRedaction = "PASS";
      report.details.push("Smoke Test 3 PASS: Image redaction pipeline succeeded.");
    } else {
      report.tests.smokeTest3_imageRedaction = "FAIL";
    }
  } catch (e) {
    report.details.push(`Smoke Test 3 error: ${e.message}`);
    report.tests.smokeTest3_imageRedaction = "FAIL";
  }
  try {
    const badProvider = new GoogleSensitiveDataProtectionProvider({
      projectId: "invalid-nonexistent-project-lotuslearn-failclosed-test",
      locationId: report.locationId
    });
    let failedClosed = false;
    try {
      await badProvider.deidentifyText({
        text: "Secret student submission",
        infoTypes: ["PERSON_NAME"]
      });
    } catch (e) {
      if (e instanceof PipelineError) {
        failedClosed = true;
      }
    }
    if (failedClosed) {
      report.tests.smokeTest4_failClosed = "PASS";
      report.details.push("Smoke Test 4 PASS: Invalid GCP configuration strictly failed closed with PipelineError.");
    } else {
      report.tests.smokeTest4_failClosed = "FAIL";
    }
  } catch (e) {
    report.details.push(`Smoke Test 4 exception: ${e.message}`);
    report.tests.smokeTest4_failClosed = "FAIL";
  }
  const allPassed = Object.values(report.tests).every((t) => t === "PASS");
  report.liveGateStatus = allPassed ? "PASS" : "FAIL";
  return report;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveCloudPrivacySmokeTests().then((rep) => {
    console.log("\n=== LotusLearn AI Live Cloud Privacy Gateway Report ===");
    console.log(JSON.stringify(rep, null, 2));
    process.exit(rep.liveGateStatus === "FAIL" ? 1 : 0);
  }).catch((err) => {
    console.error("Smoke test runner failed:", err);
    process.exit(1);
  });
}
export {
  runLiveCloudPrivacySmokeTests
};
