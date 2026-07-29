export type NftCurrency = 'ETH' | 'TRB'

export interface NftDefinition { name: string; price: number }

export const nfts: Record<NftCurrency, NftDefinition[]> = {
  ETH: [
    ['neo', 1], ['nikeeeneo', 15], ['doctor neo', 85], ['spooneo', 219], ['demonneo', 666],
    ['jokeneo', 1000], ['sevenneo', 33300], ['duckneo', 100000], ['oceankingneo', 120000],
    ['sir neo', 250000], ['prisoneo', 700007], ['birthdayneo', 750000], ['oldneo', 900000],
    ['coronaneo', 1600000], ['01neo', 10000000], ['3dneo', 45000000],
  ].map(([name, price]) => ({ name: name as string, price: price as number })),
  TRB: [45000000, 45000000, 45000000, 45000000, 45000000].map((price, i) =>
    ({ name: ['Red moon', 'Ink flowers', '8-bit pods', 'Rat look', 'Doogie'][i], price })),
}

const KEY = 'business-empire.investments.nfts.v1'
export type OwnedNfts = Record<NftCurrency, string[]>
export function loadOwnedNfts(): OwnedNfts {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '') as Partial<OwnedNfts>
    return { ETH: Array.isArray(value.ETH) ? value.ETH : [], TRB: Array.isArray(value.TRB) ? value.TRB : [] }
  } catch { return { ETH: [], TRB: [] } }
}
export function saveOwnedNfts(value: OwnedNfts) { try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* private mode */ } }
