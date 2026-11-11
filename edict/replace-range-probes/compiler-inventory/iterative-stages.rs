// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Per-case observations; earlier-stage inference is bound to inspected compiler code.

use super::selected_pair;
use anyhow::{ensure, Context, Result};
use serde::Serialize;
use serde_json::Value;
use std::path::Path;

const INSPECTED_COMPILER: &str = "66bf6bac369f67e32ddaee099c3198bd30f885a1";

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum Status {
    Accepted,
    Refused,
    Failed,
    Selected,
    Unreached,
    Unmeasured,
}

#[derive(Serialize)]
struct Fact {
    status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    basis: Option<&'static str>,
}

impl Fact {
    fn new(status: Status, basis: Option<&'static str>) -> Self {
        Self { status, basis }
    }

    fn unmeasured() -> Self {
        Self::new(Status::Unmeasured, None)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Observation {
    name: String,
    source: Fact,
    core: Fact,
    target: Fact,
    provider_lowerer: Fact,
    verifier: Fact,
    runtime: Fact,
    full_operation: Fact,
    #[serde(skip_serializing_if = "Option::is_none")]
    first_refusal: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    runtime_diagnostic: Option<String>,
}

impl Observation {
    fn new(name: &str) -> Self {
        Self {
            name: name.into(),
            source: Fact::unmeasured(),
            core: Fact::unmeasured(),
            target: Fact::unmeasured(),
            provider_lowerer: Fact::unmeasured(),
            verifier: Fact::unmeasured(),
            runtime: Fact::unmeasured(),
            full_operation: Fact::unmeasured(),
            first_refusal: None,
            runtime_diagnostic: None,
        }
    }

    fn prefix(&mut self, boundary: usize, inspected: bool) {
        for (index, stage) in [
            &mut self.source,
            &mut self.core,
            &mut self.target,
            &mut self.provider_lowerer,
            &mut self.verifier,
        ]
        .into_iter()
        .enumerate()
        {
            if index < boundary && inspected {
                *stage = Fact::new(Status::Accepted, Some("pinned-public-command-order"));
            } else if index == boundary {
                *stage = Fact::new(Status::Refused, Some("public-diagnostic"));
            } else if index > boundary {
                *stage = Fact::new(Status::Unreached, None);
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    schema: &'static str,
    inventory_sha256: String,
    compiler_commit: String,
    published_components: Fact,
    provider_inventory: Value,
    cases: Vec<Observation>,
}

impl Report {
    pub fn record_runtime(&mut self, name: &str, result: &Result<()>) -> Result<()> {
        let case = self
            .cases
            .iter_mut()
            .find(|item| item.name == name)
            .context("missing observed case")?;
        if case.verifier.status == Status::Accepted {
            case.runtime = Fact::new(
                if result.is_ok() {
                    Status::Accepted
                } else {
                    Status::Failed
                },
                Some("generic-pure-boundary-witness"),
            );
            case.runtime_diagnostic = result.as_ref().err().map(|error| format!("{error:#}"));
        }
        Ok(())
    }
}

fn boundary(diagnostic: &Value) -> Option<usize> {
    match diagnostic["kind"].as_str() {
        Some("InvalidApplicationSourceClosure") => Some(0),
        Some("ProviderLowererRefused") => Some(3),
        Some("ProviderVerifierRefused") => Some(4),
        Some("TargetLoweringFailed") => Some(2),
        _ => match diagnostic["stage"].as_str() {
            Some("parse" | "surfaceValidation" | "resolve" | "typeCheck") => Some(0),
            Some("lowerCore") => Some(1),
            _ => None,
        },
    }
}

fn describe(root: &Path, evidence: &Value, case: &Value, inspected: bool) -> Result<Observation> {
    let name = case["name"].as_str().context("case name")?;
    let mut result = Observation::new(name);
    if case["exitCode"] == 0 {
        // Verify the package/report/Target/projection binding, including the baseline.
        selected_pair(root, evidence, name)?;
        result.prefix(5, inspected);
        result.verifier = Fact::new(Status::Accepted, Some("bound-verification-report"));
    } else {
        let diagnostics = case["diagnostics"].as_array().context("case diagnostics")?;
        let first = diagnostics
            .iter()
            .find(|item| item["type"] == "diagnostic" && item["severity"] == "error")
            .context("missing public refusal")?;
        if let Some(index) = boundary(first) {
            result.prefix(index, inspected);
            result.runtime = Fact::new(Status::Unreached, None);
        }
        result.first_refusal = Some(first.clone());
    }
    Ok(result)
}

pub fn inventory(root: &Path, evidence: &Value, pin: &str) -> Result<Report> {
    let compiler = evidence["selectedInputs"]["compilerCommit"]
        .as_str()
        .context("compiler commit")?;
    let cases = evidence["results"].as_array().context("case results")?;
    ensure!(!cases.is_empty(), "empty stage inventory");
    let observations = cases
        .iter()
        .map(|case| describe(root, evidence, case, compiler == INSPECTED_COMPILER))
        .collect::<Result<Vec<_>>>()?;
    Ok(Report {
        schema: "jedit.iterative-stages/v1",
        inventory_sha256: pin.into(),
        compiler_commit: compiler.into(),
        published_components: Fact::new(Status::Selected, Some("retained-provider-inventory")),
        provider_inventory: evidence["selectedInputs"]["provider"].clone(),
        cases: observations,
    })
}
