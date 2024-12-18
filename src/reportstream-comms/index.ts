// generate-jwt.ts

import axios from 'axios'
import { nanoid } from 'nanoid'
import { KJUR } from 'jsrsasign'
/**
 * Generates a JSON Web Token (JWT) for client authentication.
 *
 * @param key The private key in PEM format used for signing the JWT.
 * @param clientId The client identifier.  Can be sent as the ISS.
 * @param kid Key Identifier used in JWT.  The kid is set when ReportStream
 * loads the credential and follows the format of orgname.unique-value (org name
 * here is synonymous with client-id). By convention if there is only one key,
 * ReportStram uses orgname.default, but theoretically this could be
 * orgname.<any-value>, so we need the kid.
 * @param algorithm The signing algorithm, either RS256 or ES384.
 * @param aud The audience that should receive the token.
 * @returns The signed JWT.
 */
function generateJWT (
  key: string,
  clientId: string,
  kid: string,
  algorithm: 'RS256' | 'ES384',
  aud = 'staging.prime.cdc.gov'
): string {
  const now = Math.floor(Date.now() / 1000)
  const payloadData = {
    iss: clientId,
    sub: kid,
    aud,
    exp: now + 300, // Expire in 5 minutes
    jti: nanoid() // Unique identifier for the JWT
  }

  const headerData = {
    kid,
    typ: 'JWT',
    alg: algorithm // Algorithm used for signing the JWT
  }

  // const keyObj = KEYUTIL.getKey(key)
  // Signs and returns the JWT.
  const token = KJUR.jws.JWS.sign(
    headerData.alg,
    headerData,
    payloadData,
    key
  )

  return token
}

/**
 * Exchanges a JWT for a Bearer Token.
 *
 * @param aud - The audience for the token
 * @param scope - The scope of the token
 * @param jwt - The JWT to exchange.
 * @throws Will throw an AxiosError exception if something goes horribly wrong.
 * @returns A promise that resolves to the bearer token.
 */
async function exchangeJWTForBearerToken (aud: string, scope: string, jwt: string): Promise<string> {
  const params = new URLSearchParams()
  params.append('scope', scope)
  params.append('grant_type', 'client_credentials')
  params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
  params.append('client_assertion', jwt)

  const response = await axios.post(`https://${aud}/api/token`, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  // Returns the access token from the response.
  return response.data.access_token
}

export { generateJWT, exchangeJWTForBearerToken }
