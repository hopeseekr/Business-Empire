import raw from './clothing_collections.json'
import type { ClothingCollection } from '../types'

/** All clothing collections from the game (includes known rotation duplicates). */
export const collections: ClothingCollection[] = raw as ClothingCollection[]

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

export const styles = uniqueSorted(collections.map((c) => c.style))
export const qualities = uniqueSorted(collections.map((c) => c.quality))
export const prices = uniqueSorted(collections.map((c) => c.price))
export const audiences = uniqueSorted(collections.map((c) => c.audience))

export function searchCollections(
  query: string,
  filters: {
    style?: string
    quality?: string
    price?: string
    audience?: string
  } = {},
): ClothingCollection[] {
  const q = query.trim().toLowerCase()
  return collections.filter((c) => {
    if (filters.style && c.style !== filters.style) return false
    if (filters.quality && c.quality !== filters.quality) return false
    if (filters.price && c.price !== filters.price) return false
    if (filters.audience && c.audience !== filters.audience) return false
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.style.toLowerCase().includes(q) ||
      c.quality.toLowerCase().includes(q) ||
      c.price.toLowerCase().includes(q) ||
      c.audience.toLowerCase().includes(q)
    )
  })
}
