import {
  cre,
  consensusIdenticalAggregation,
  type Runtime
} from "@chainlink/cre-sdk";
import { CustodianDataSchema } from "../types.js";
import { CustodianApiError } from "../errors.js";
import { type Config } from "../Main.js";
import type { CustodianData } from "../types.js";

const { HTTPClient } = cre.capabilities;

export async function fetchCustodianData(
  runtime: Runtime<Config>,
  config: Config
): Promise<CustodianData> {
  const { issuerAddress, periodLabel, reportingEpoch, custodianApiUrl } = config;

  const url = `${custodianApiUrl}/reports/${issuerAddress}?period=${periodLabel}&epoch=${reportingEpoch}`;

  runtime.log(`Fetching custodian data from: ${url}`);

  const httpClient = new HTTPClient();

  try {
    const response = await runtime.runInNodeMode(async (nodeRuntime) => {
      const res = httpClient.sendRequest(nodeRuntime, {
        url,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CUSTODIAN_API_KEY || "mock-key"}`,
        },
      });
      return res.result();
    }, consensusIdenticalAggregation<any>() as any)().result();

    if (response.statusCode !== 200) {
      throw new CustodianApiError(
        `Custodian API returned status ${response.statusCode}`,
        response.statusCode
      );
    }

    const bodyStr = new TextDecoder().decode(response.body);
    const data = JSON.parse(bodyStr);
    return CustodianDataSchema.parse(data);
  } catch (err: unknown) {
    runtime.log(`Custodian fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
