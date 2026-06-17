/**
 * Validate that a string conforms to IPFS CIDv0 or CIDv1 hash formats.
 */
export function validateIpfsHash(hash: string): boolean {
  const cidv0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const cidv1Regex = /^b[a-z2-7]{58}$/i;
  return cidv0Regex.test(hash) || cidv1Regex.test(hash);
}
