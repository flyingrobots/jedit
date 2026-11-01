// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Historical echoCommit recorded a checkout observation, not provider-source attestation.
export function inventoryProvenance(prior) {
  const { compilerCommit } = prior;
  const echoCheckoutCommit = Object.hasOwn(prior, 'echoCheckoutCommit')
    ? prior.echoCheckoutCommit : prior.echoCommit;
  const commitPattern = /^[a-f0-9]{40}$/;
  if (![compilerCommit, echoCheckoutCommit].every(value =>
    typeof value === 'string' && commitPattern.test(value))) {
    throw new Error('invalid inventory provenance: expected full compiler and Echo checkout commits');
  }
  if (Object.hasOwn(prior, 'echoCommit') && prior.echoCommit !== echoCheckoutCommit) {
    throw new Error('conflicting inventory provenance: Echo checkout labels disagree');
  }
  return { compilerCommit, echoCheckoutCommit };
}
