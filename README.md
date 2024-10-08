# Report Stream MARS Hub Library.

## Overview
This TypeScript library communicates with the RADx MARS ReportStream Hub.  It
depends on the base RADx MARS Library `radx-mars-lib` available on the [NIBIB
GitHub](https://github.com/NIBIB/).

This library generates a JSON Web Token (JWT) and uses it to authenticate with a server to submit HL7 data. The process involves three primary steps:

1. **JWT Generation:** Creates a signed JWT using a private key and other required details.
2. **JWT Exchange:** Exchanges the generated JWT for a bearer token.
3. **Data Submission:** Submits HL7 data using the bearer token for authentication.


## Flow

### `generateJWT`
Generates a JWT using the specified private key, client ID, key identifier, and algorithm. It sets a 5-minute expiration for the token.

### `exchangeJWTForBearerToken`
Exchanges the generated JWT for a bearer token from the authentication server. This token is then used for subsequent authenticated requests.

### Data Submission
Submits HL7 data to a specific server endpoint. It requires a bearer token for authentication and the file path to the HL7 data.

## Usage

This library provides a `ReportStreamHubProvider` class that is capable of submitting to 
the ReportStream MARS hub via its `submitTest` method.  
Its functionality is demonstrated in the
[demo project](https://github.com/NIBIB/radx-mars-demo).  

