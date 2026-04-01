export type ConnectorTextBlock = { type: 'connector_text'; text: string };
export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock { return false; }
