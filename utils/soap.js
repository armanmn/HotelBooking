// utils/soap.js
export function buildSoapEnvelope({ requestType, operation, innerXml, agency, user, password }) {
  return `
<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <MakeRequest xmlns="http://www.goglobal.travel/">
      <requestType>${requestType}</requestType>
      <xmlRequest><![CDATA[
<Root>
  <Header>
    <Agency>${agency}</Agency>
    <User>${user}</User>
    <Password>${password || ""}</Password>
    <Operation>${operation}</Operation>
    <OperationType>Request</OperationType>
  </Header>
  ${innerXml}
</Root>
      ]]></xmlRequest>
    </MakeRequest>
  </soap12:Body>
</soap12:Envelope>
`.trim();
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/**
 * Վերադարձնում է provider payload-ը՝
 * - JSON object (եթե հնարավոր է)
 * - կամ { __rawXml: "<Root>...</Root>" } fallback, երբ JSON չկա
 */
export function extractProviderPayload(soapText) {
  const m = soapText.match(/<MakeRequestResult>([\s\S]*?)<\/MakeRequestResult>/i);
  if (!m) {
    const snip = soapText.slice(0, 600);
    throw new Error(`No MakeRequestResult in SOAP. Snippet: ${snip}`);
  }
  const raw = m[1]?.trim() || "";
  const decoded = decodeEntities(raw).trim();

  // Փորձում ենք JSON
  const maybeJson = decoded.trim();
  if (maybeJson.startsWith("{") || maybeJson.startsWith("[")) {
    try {
      return JSON.parse(maybeJson);
    } catch (_e) {
      // ընկնում ենք XML fallback
    }
  }

  // XML fallback
  if (decoded.includes("<Root")) {
    return { __rawXml: decoded };
  }

  // Եթե ոչ JSON, ոչ էլ XML՝ վերադարձնում ենք որպես crude string
  return { __rawXml: decoded };
}