/**
 * Represents a client's configuration with a ReportStream server and contains
 * all of the information necessary to communicate with said server.
 * @param clientId - The client identifier.  Can be sent as the ISS.  This
 * field will be provided to the lab by the CDC as part of the onboarding
 * process.
 * @param kid - Key Identifier (kid) provided to the lab by the CDC as part of
 * the onboarding process.  The kid follows the format of clientId.unique-value
 * By convention if there is only one kid, ReportStram uses clientId.default,
 * but theoretically this could be clientId.<any-value>.
 * @param privatePemString - The private key in PEM format used for signing the
 * JWT.  This will be the private portion of the key generated and shared with
 * CDC.
 * @param algorithm - The signing algorithm, either RS256 or ES384.  This should
 * correspond to the public/private keypair type generated and provided to the
 * CDC by the laboratory and, thus, the type of PEM used in the string
 * parameter privatePemString
 */
interface ReportStreamConfig {
  clientId: string
  kid: string
  privatePemString: string
  algorithm: 'RS256' | 'ES384'
}

export default ReportStreamConfig