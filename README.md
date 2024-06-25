# Report Stream MARS Hub Library.

## Overview
This TypeScript library communicates with the RADx MARS ReportStream Hub.  It depends on the base RADx MARS Library `radx-mars-lib` available on the NIBIB portal.

This library generates a JSON Web Token (JWT) and uses it to authenticate with a server to submit HL7 data. The process involves three primary steps:

1. **JWT Generation:** Creates a signed JWT using a private key and other required details.
2. **JWT Exchange:** Exchanges the generated JWT for a bearer token.
3. **Data Submission:** Submits HL7 data using the bearer token for authentication.

This library, on its own, does nothing.  Sample implementations of this library are currently available in the radx-mars-demo project.

## Functions

### `generateJWT`
Generates a JWT using the specified private key, client ID, key identifier, and algorithm. It sets a 5-minute expiration for the token.

### `exchangeJWTForBearerToken`
Exchanges the generated JWT for a bearer token from the authentication server. This token is then used for subsequent authenticated requests.

### `submitData`
Submits HL7 data to a specific server endpoint. It requires a bearer token for authentication and the file path to the HL7 data.

## Usage

To use the library, follow these steps:

1. Replace `myPrivateKeyPem` with your actual private key.
2. Set `myClientId` and `myKid` to your client ID and key identifier, respectively.
3. Call `generateJWT` to create a JWT.
4. Exchange the JWT for a bearer token using `exchangeJWTForBearerToken`.
5. Submit HL7 data using `submitData` with the obtained bearer token and the path to your HL7 file.

Example:

```typescript
const myPrivateKeyPem = `Your private key here`
const myJwt = generateJWT(myPrivateKeyPem, 'yourClientID', 'yourKeyID', 'ES384')
exchangeJWTForBearerToken(myJwt).then(bearerToken => {
  submitData(bearerToken, './path/to/your/hl7/file').then(() => {
    console.log('HL7 data submitted successfully')
  }).catch(err => console.error('Error submitting HL7 data:', err))
}).catch(err => console.error('Error getting bearer token:', err))

