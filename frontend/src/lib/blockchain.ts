// Blockchain explorer URL helpers for crypto transaction verification

const EXPLORER_TX: Record<string, string> = {
  TRC20: 'https://tronscan.org/#/transaction/',
  ERC20: 'https://etherscan.io/tx/',
  BEP20: 'https://bscscan.com/tx/',
  BTC: 'https://mempool.space/tx/',
};

const EXPLORER_ADDR: Record<string, string> = {
  TRC20: 'https://tronscan.org/#/address/',
  ERC20: 'https://etherscan.io/address/',
  BEP20: 'https://bscscan.com/address/',
  BTC: 'https://mempool.space/address/',
};

const EXPLORER_NAME: Record<string, string> = {
  TRC20: 'Tronscan',
  ERC20: 'Etherscan',
  BEP20: 'BscScan',
  BTC: 'Mempool',
};

export function getTxExplorerUrl(txHash: string, network?: string | null): string | null {
  if (!txHash || !network) return null;
  const normalized = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
  if (!/^[a-fA-F0-9]+$/.test(normalized)) return null;
  const base = EXPLORER_TX[network];
  return base ? `${base}${txHash}` : null;
}

export function getAddressExplorerUrl(address: string, network?: string | null): string | null {
  if (!address || !network) return null;
  if (!/^[a-zA-Z0-9]+$/.test(address)) return null;
  const base = EXPLORER_ADDR[network];
  return base ? `${base}${address}` : null;
}

export function getExplorerName(network?: string | null): string {
  if (!network) return 'Explorer';
  return EXPLORER_NAME[network] || 'Explorer';
}

export function shortenHash(hash: string, start = 8, end = 6): string {
  if (hash.length <= start + end + 3) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}
