import { type MarsHubProvider, IsoHierarchicDesignator } from 'radx-mars-lib'
import type ReportStreamConfig from './ReportStreamConfig'
import { generateJWT, exchangeJWTForBearerToken } from './reportstream-comms'
import axios from 'axios'

/**
 * The ReportStreamHubProvider is a {@link MarsHubProvider} implementation
 * capable of delivering HL7 messages to the CDC ReportStream MARS compliant hub
 * for routing of HL7 ELR 2.5.1 messages to health departments as part of
 * fulfilling obligations of participation in the RADx program.
 */
export default class ReportStreamHubProvider implements MarsHubProvider {
  private readonly _useProduction: boolean = false
  private readonly _reportStreamConfig: ReportStreamConfig
  private readonly _receivingApplication: IsoHierarchicDesignator =
    new IsoHierarchicDesignator('CDC PRIME', '2.16.840.1.114222.4.1.237821')

  private readonly _receivingFacility: IsoHierarchicDesignator =
    new IsoHierarchicDesignator('CDC PRIME', '2.16.840.1.114222.4.1.237821')

  /**
   * Constructs an {@link ReportStreamHubProvider} with configuration specific
   * to a laboratory's configuration as supplied by CDC.
   *
   * @param reportStreamConfig A {@link ReportStreamConfig} object encapsulating
   * the configuration information for the laboratory with ReportStream as
   * provided by the CDC.
   * @param useProduction an optional boolean flag indicating whether or not
   * the provider is to communicate with the production or staging
   * environments. If not provided, a value of false is assumed and the
   * provider will communicate with the staging environment.
   */
  constructor (
    reportStreamConfig: ReportStreamConfig,
    useProduction: boolean = false
  ) {
    this._reportStreamConfig = reportStreamConfig
    this._useProduction = useProduction
  }

  get receivingApplicationIdentifier (): IsoHierarchicDesignator {
    return this._receivingApplication
  }

  get receivingFacilityIdentifier (): IsoHierarchicDesignator {
    return this._receivingFacility
  }

  get isUsingProduction (): boolean {
    return this._useProduction
  }

  /**
   * Overrides the base {@link MarsHubProvider}'s submitTest message.  This
   * method handles the actual delivery of the HL7 message (provided to it as
   * a string argument) to AIMS.
   *
   * @param hl7Message the message to send.
   * @returns a boolean value indicating successful delivery.
   */
  async submitTest (hl7Message: string): Promise<boolean> {
    // TODO: Build a result that can be used across providers with some sort
    // of "check-point"
    let endpoint: string = 'https://staging.prime.cdc.gov/api/waters'

    if (this.isUsingProduction) {
      // TODO: Confirm production endpoint
      endpoint = 'https://staging.prime.cdc.gov/api/waters'
    }

    const myJwt = generateJWT(
      this._reportStreamConfig.privatePemString,
      this._reportStreamConfig.clientId,
      this._reportStreamConfig.kid,
      this._reportStreamConfig.algorithm
    )

    const bearerToken = await exchangeJWTForBearerToken(myJwt)

    try {
      await axios.post(endpoint, hl7Message, {
        headers: {
          authorization: `Bearer ${bearerToken}`,
          client: this._reportStreamConfig.clientId, // Client identifier
          'content-type': 'application/hl7-v2'
        }
      })
      console.log('Data submitted successfully')
      return true
    } catch (error) {
      console.error('Error submitting data:', error)
      throw error
    }
  }
}
