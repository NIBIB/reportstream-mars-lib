// generate-jwt.ts

import * as jwt from 'jsonwebtoken'
import * as uuid from 'uuid'

import fs from 'fs'
import axios from 'axios'

function generateJWT (
  key: string,
  clientId: string,
  kid: string,
  algorithm: 'RS256' | 'ES384',
  typ = 'JWT'
): string {
  const now = Math.floor(Date.now() / 1000)
  const payloadData = {
    iss: kid,
    sub: kid,
    aud: 'staging.prime.cdc.gov',
    exp: now + 300, // Expire in 5 minutes
    jti: uuid.v4()
  }

  const headerData = {
    kid,
    typ,
    alg: algorithm
  }

  const token = jwt.sign(
    payloadData,
    key,
    { algorithm, header: headerData }
  )

  return token
}

async function exchangeJWTForBearerToken (jwt: string): Promise<string> {
  const params = new URLSearchParams()
  params.append('scope', 'meadowsdesign.*.report')
  params.append('grant_type', 'client_credentials')
  params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
  params.append('client_assertion', jwt)

  try {
    const response = await axios.post('https://staging.prime.cdc.gov/api/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    return response.data.access_token // Assuming the token is in the access_token field
  } catch (error) {
    console.error('Error exchanging JWT for bearer token:', error)
    throw error
  }
}

async function submitData (bearerToken: string, hl7FilePath: string): Promise<void> {
  const hl7Data = fs.readFileSync(hl7FilePath, 'utf8')

  try {
    await axios.post('https://staging.prime.cdc.gov/api/waters', hl7Data, {
      headers: {
        authorization: `Bearer ${bearerToken}`,
        client: 'meadowsdesign', // Client ID
        'content-type': 'application/hl7-v2'
      }
    })

    console.log('Data submitted successfully')
  } catch (error) {
    console.error('Error submitting data:', error)
    throw error
  }
}

// Example usage
const myClientId = 'meadowsdesign' // Replace with your client-id
const myKid = 'meadowsdesign.default'
const myPrivateKeyPem = `-----BEGIN EC PRIVATE KEY-----
-----END EC PRIVATE KEY-----`

// console.log(`Generated JWT: ${generateJWT(myPrivateKeyPem, myClientId, myKid)}`);

// Assuming generateJWT function is defined as per previous discussions
const myJwt = generateJWT(myPrivateKeyPem, myClientId, myKid, 'ES384' /* parameters */)

exchangeJWTForBearerToken(myJwt).then(bearerToken => {
  submitData(bearerToken, './sample.hl7').then(() => {
    console.log('HL7 data submitted successfully')
  }).catch(err => console.error('Error submitting HL7 data:', err))
}).catch(err => console.error('Error getting bearer token:', err))

// QUESTIONS
// scope: is it always $clientId.*.report?
//