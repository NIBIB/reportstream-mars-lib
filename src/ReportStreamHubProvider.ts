/* eslint-disable @typescript-eslint/consistent-type-definitions */
import {
  type MarsHubProvider,
  IsoHierarchicDesignator,
  type TestSubmissionResult,
  type HubSubmissionResult,
  HubSubmissionResultStatus,
  type HierarchicDesignator
} from 'radx-mars-lib'
import type ReportStreamConfig from './ReportStreamConfig'
import { generateJWT, exchangeJWTForBearerToken } from './reportstream-comms'
import axios, { AxiosError, type AxiosResponse } from 'axios'

type ReportStreamDeliveryResponse = {
  destinationCount: number
  reportItemCount: number
  errorCount: number
  warningCount: number
  destinations: Array<{
    itemCount: number
    // eslint-disable-next-line @typescript-eslint/ban-types
    sentReports?: Array<{}> }>
}
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

  get receivingApplicationIdentifier (): HierarchicDesignator {
    return this._receivingApplication
  }

  get receivingFacilityIdentifier (): HierarchicDesignator {
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
  async submitTest (hl7Message: string): Promise<TestSubmissionResult> {
    let aud: string = 'staging.prime.cdc.gov'

    if (this.isUsingProduction) {
      aud = 'prime.cdc.gov'
    }

    let myJwt: string

    try {
      myJwt = generateJWT(
        this._reportStreamConfig.privatePemString,
        this._reportStreamConfig.clientId,
        this._reportStreamConfig.kid,
        this._reportStreamConfig.algorithm,
        aud
      )
    } catch (error: any) {
      // Yes, I know this is terrible and we catch just to log and then rethrow.
      // That said, if something happens and the user doesn't know exactly why
      // something bad is happening -- like an ill formatted PEM, they'll just
      // see a submission error. We're trying to provide a little more detail in
      // the dump for the user here other than something like jsrsasign's
      // 'init failed:Error: not supported argument.'
      return {
        id: null,
        retryable: false,
        successful: false,
        warnings: [],
        errors: [`Error generating JWT.  Confirm your PEM is correct: ${error.name}`]
      }
    }

    try {
      const bearerToken = await exchangeJWTForBearerToken(
        aud,
        this._reportStreamConfig.scope,
        myJwt
      )

      const result = await axios.post(`https://${aud}/api/waters`, hl7Message, {
        headers: {
          authorization: `Bearer ${bearerToken}`,
          client: this._reportStreamConfig.clientId, // Client identifier
          'content-type': 'application/hl7-v2'
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const guaranteedResult: AxiosResponse = result
      const errorsAndWarnings =
        this._parseErrorAndWarningResponse(guaranteedResult)

      if (guaranteedResult.status < 300) {
        return {
          successful: true,
          retryable: false,
          id: `${guaranteedResult.data.submissionId}`,
          ...errorsAndWarnings
        }
      }

      // This is unlikely to fire.  Axios supposedly will throw an exception
      // for non-success.  That said, it's not well documented this is the
      // case and MAY change in the future so we're going to belt/suspender
      // this puppy.
      return {
        successful: false,
        retryable: false,
        id: null,
        errors: ['An unexpected error occurred submitting the test resulting in an unknown internal state'],
        warnings: ['Here be dragons!']
      }
    } catch (error: any) {
      if (!(error instanceof AxiosError)) {
        console.error('Error submitting data:', error)
        return {
          successful: false,
          retryable: false,
          id: null,
          errors: [`Error submitting data:, ${error.name ?? 'Unknown error'}`],
          warnings: []
        }
      }

      const axiosError = error as AxiosError

      if (axiosError.response) {
        const errorResponse = axiosError.response
        const statusCode: number = errorResponse.status

        const submissionId: (number | null) = (errorResponse.data as { submissionId: number | null }).submissionId

        return {
          successful: false,
          id: submissionId?.toString() ?? null,
          retryable: statusCode >= 500 || [408, 429].includes(statusCode),
          // eslint-disable-next-line max-len
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
          ...this._parseErrorAndWarningResponse(errorResponse)
        }
      }

      if (![null, undefined].includes(axiosError.request)) {
        return {
          successful: false,
          retryable: true,
          id: null,
          errors: [`A network error has occurred: ${error.name}`],
          warnings: ['Here be dragons!']
        }
      }

      return {
        successful: false,
        retryable: false,
        id: null,
        errors: [`${error.name ?? 'Unknown error'}`],
        warnings: []
      }
    }
  }

  public async retrieveSubmissionResult (submissionId: string): Promise<HubSubmissionResult> {
    let aud: string = 'staging.prime.cdc.gov'

    if (this.isUsingProduction) {
      aud = 'prime.cdc.gov'
    }

    let myJwt: string

    try {
      myJwt = generateJWT(
        this._reportStreamConfig.privatePemString,
        this._reportStreamConfig.clientId,
        this._reportStreamConfig.kid,
        this._reportStreamConfig.algorithm,
        aud
      )
    } catch (error: any) {
      // Yes, I know this is terrible and we catch just to log and then rethrow.
      // That said, if something happens and the user doesn't know exactly why
      // something bad is happening -- like an ill formatted PEM, they'll just
      // see a submission error. We're trying to provide a little more detail in
      // the dump for the user here other than something like jsrsasign's
      // 'init failed:Error: not supported argument.'
      return {
        submissionId,
        status: HubSubmissionResultStatus.error,
        successful: false,
        warnings: [],
        errors: [`Error generating JWT.  Confirm your PEM is correct: ${error.name}`]
      }
    }

    try {
      const bearerToken = await exchangeJWTForBearerToken(
        aud,
        this._reportStreamConfig.scope,
        myJwt
      )

      const result = await axios.get(`https://${aud}/api/waters/report/${submissionId}/history`, {
        headers: {
          authorization: `Bearer ${bearerToken}`,
          client: this._reportStreamConfig.clientId, // Client identifier
          'content-type': 'application/hl7-v2'
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      // const guaranteedResult: AxiosResponse = result
      const errorsAndWarnings =
        this._parseErrorAndWarningResponse(result)

      if (result.status < 300) {
        const status = this._calculateDeliveryStatus(result.data)
        return {
          status,
          successful: true,
          submissionId: `${result.data.submissionId}`,
          ...errorsAndWarnings
        }
      }

      // This is unlikely to fire.  Axios supposedly will throw an exception
      // for non-success.  That said, it's not well documented this is the
      // case and MAY change in the future so we're going to belt/suspender
      // this puppy.
      return {
        status: result.status === 404 ? HubSubmissionResultStatus.notFound : HubSubmissionResultStatus.error,
        successful: false,
        submissionId,
        errors: ['An unexpected error occurred submitting the test resulting in an unknown internal state'],
        warnings: ['Here be dragons!']
      }
    } catch (error: any) {
      if (!(error instanceof AxiosError)) {
        console.error('Error submitting data:', error)
        return {
          status: HubSubmissionResultStatus.error,
          successful: false,
          submissionId,
          errors: [`Error submitting data:, ${error.name ?? 'Unknown error'}`],
          warnings: []
        }
      }

      const axiosError = error as AxiosError

      if (axiosError.response) {
        const errorResponse = axiosError.response
        const statusCode: number = errorResponse.status

        const submissionId: (number | null) = (errorResponse.data as { submissionId: number | null }).submissionId

        // Server problem or the like.
        return {
          successful: false,
          submissionId: submissionId?.toString() ?? null,
          status: (statusCode >= 500 || [408, 429].includes(statusCode))
            ? HubSubmissionResultStatus.unavailable
            : HubSubmissionResultStatus.error,
          // eslint-disable-next-line max-len
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
          ...this._parseErrorAndWarningResponse(errorResponse)
        }
      }

      // Network problem.
      if (![null, undefined].includes(axiosError.request)) {
        return {
          successful: false,
          status: HubSubmissionResultStatus.unavailable,
          submissionId: null,
          errors: [`A network error has occurred: ${error.name}`],
          warnings: ['Here be dragons!']
        }
      }

      // Other problem.
      return {
        successful: false,
        status: HubSubmissionResultStatus.error,
        submissionId: null,
        errors: [`${error.name ?? 'Unknown error'}`],
        warnings: []
      }
    }
  }

  private _calculateDeliveryStatus (response: ReportStreamDeliveryResponse): HubSubmissionResultStatus {
    const destinations = response.destinations
    const intendedDestinationCount = response.destinationCount ?? 0

    if (response.errorCount > 0) {
      return HubSubmissionResultStatus.error
    }

    if (intendedDestinationCount === 0) {
      return HubSubmissionResultStatus.received
    }

    destinations?.forEach((d) => {
      if (d.itemCount !== d.sentReports?.length) {
        return HubSubmissionResultStatus.processing
      }
    })

    return HubSubmissionResultStatus.processed
  }

  private _parseErrorAndWarningResponse (
    response: AxiosResponse
  ): { errors: string[], warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    response.data.errors?.forEach((error: { scope: string, message: string }) => {
      errors.push(`Scope: ${error.scope}; ${error.message}`)
    })
    response.data.warnings?.forEach((warning: { scope: string, message: string }) => {
      warnings.push(`Scope: ${warning.scope}; ${warning.message}`)
    })

    return { errors, warnings }
  }
}
