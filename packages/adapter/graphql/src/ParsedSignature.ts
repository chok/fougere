/** Parsed method signature (mirrors core OperationMeta.signature). */
export interface ParsedSignature {
  name: string;
  params: { name: string; type: { raw: string; name: string; array?: boolean; nullable?: boolean; undefined?: boolean; generics?: ParsedSignature['params'][0]['type'][] }; optional?: boolean }[];
  returnType?: { raw: string; name: string; array?: boolean; nullable?: boolean; undefined?: boolean; generics?: ParsedSignature['params'][0]['type'][] };
}
