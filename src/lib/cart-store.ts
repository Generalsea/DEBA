'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { CartDeliverySelection, CartItem, CartProduct, DeliveryMethod } from '@/lib/types'

const STORAGE_KEY = 'deba-cart-storage-v2'

type Snapshot = {
  items: CartItem[]
  savedItems: CartItem[]
  deliverySelections: CartDeliverySelection
  hydrated: boolean
}

const emptySnapshot: Snapshot = { items: [], savedItems: [], deliverySelections: {}, hydrated: false }
let snapshot: Snapshot = emptySnapshot
let hydrated = false
const listeners = new Set<() => void>()

function emit() { listeners.forEach((listener) => listener()) }
function persist() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    items: snapshot.items, savedItems: snapshot.savedItems, deliverySelections: snapshot.deliverySelections,
  }))
}
function commit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next, hydrated: true }
  persist()
  emit()
}

function normalizeProduct(input: unknown): CartProduct | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Partial<CartProduct>
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.slug !== 'string') return null
  if (typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price <= 0) return null
  if (value.listingType !== 'sale' || typeof value.sellerId !== 'string') return null
  const quantity = typeof value.quantityAvailable === 'number' && Number.isFinite(value.quantityAvailable)
    ? Math.max(0, Math.floor(value.quantityAvailable)) : 0
  const method = value.deliveryMethod === 'pickup' || value.deliveryMethod === 'seller_delivery' || value.deliveryMethod === 'platform_delivery' || value.deliveryMethod === 'both'
    ? value.deliveryMethod : 'pickup'
  return {
    id: value.id, title: value.title, slug: value.slug, price: value.price, currency: value.currency || 'EGP',
    conditionGrade: value.conditionGrade || null, listingType: 'sale', quantityAvailable: quantity, sellerId: value.sellerId,
    sellerName: value.sellerName || 'عضو DEBA', sellerAvatar: value.sellerAvatar || null, imageUrl: value.imageUrl || null,
    imageAlt: value.imageAlt || value.title, deliveryMethod: method,
  }
}
function normalizeItem(input: unknown): CartItem | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Partial<CartItem>
  const product = normalizeProduct(value.product)
  if (!product || typeof value.id !== 'string') return null
  const quantity = typeof value.quantity === 'number' && Number.isFinite(value.quantity) ? Math.max(1, Math.floor(value.quantity)) : 1
  const max = Math.max(1, product.quantityAvailable || quantity)
  return { id: value.id, product, quantity: Math.min(quantity, max), savedForLater: value.savedForLater === true, addedAt: value.addedAt || new Date().toISOString() }
}
function normalizeSelections(input: unknown): CartDeliverySelection {
  if (!input || typeof input !== 'object') return {}
  const out: CartDeliverySelection = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === 'pickup' || value === 'seller_delivery' || value === 'platform_delivery') out[key] = value
  }
  return out
}
function hydrate() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) { snapshot = { ...emptySnapshot, hydrated: true }; emit(); return }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    snapshot = {
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizeItem).filter((item): item is CartItem => Boolean(item)) : [],
      savedItems: Array.isArray(parsed.savedItems) ? parsed.savedItems.map(normalizeItem).filter((item): item is CartItem => Boolean(item)) : [],
      deliverySelections: normalizeSelections(parsed.deliverySelections), hydrated: true,
    }
    emit()
  } catch { snapshot = { ...emptySnapshot, hydrated: true }; emit() }
}
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) }
function getSnapshot() { return snapshot }
function getServerSnapshot() { return emptySnapshot }

export function useCartStore() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  useEffect(() => { hydrate() }, [])
  return value
}

export function addToCart(product: CartProduct, quantity = 1) {
  if (product.listingType !== 'sale' || product.quantityAvailable < 1) return
  const safeQuantity = Math.min(Math.max(1, Math.floor(quantity)), product.quantityAvailable)
  const existing = snapshot.items.find((item) => item.product.id === product.id)
  if (existing) {
    commit({ items: snapshot.items.map((item) => item.id === existing.id ? { ...item, product, quantity: Math.min(product.quantityAvailable, item.quantity + safeQuantity) } : item) })
    return
  }
  commit({ items: [...snapshot.items, { id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2), product, quantity: safeQuantity, addedAt: new Date().toISOString() }] })
}
export function removeFromCart(itemId: string) { commit({ items: snapshot.items.filter((item) => item.id !== itemId) }) }
export function updateCartQuantity(itemId: string, quantity: number) {
  const item = snapshot.items.find((entry) => entry.id === itemId)
  if (!item) return
  const max = Math.max(1, item.product.quantityAvailable)
  const next = Math.min(max, Math.max(1, Math.floor(quantity)))
  commit({ items: snapshot.items.map((entry) => entry.id === itemId ? { ...entry, quantity: next } : entry) })
}
export function moveCartItemToSaved(itemId: string) {
  const item = snapshot.items.find((entry) => entry.id === itemId)
  if (!item) return
  commit({ items: snapshot.items.filter((entry) => entry.id !== itemId), savedItems: [...snapshot.savedItems, { ...item, savedForLater: true }] })
}
export function moveSavedItemToCart(itemId: string) {
  const item = snapshot.savedItems.find((entry) => entry.id === itemId)
  if (!item) return
  if (snapshot.items.some((entry) => entry.product.id === item.product.id)) { removeSavedItem(itemId); return }
  if (item.product.quantityAvailable < 1) return
  commit({ savedItems: snapshot.savedItems.filter((entry) => entry.id !== itemId), items: [...snapshot.items, { ...item, savedForLater: false, quantity: Math.min(item.quantity, item.product.quantityAvailable) }] })
}
export function removeSavedItem(itemId: string) { commit({ savedItems: snapshot.savedItems.filter((item) => item.id !== itemId) }) }
export function setCartDeliveryMethod(sellerId: string, method: DeliveryMethod | null) {
  const next = { ...snapshot.deliverySelections }
  if (method) next[sellerId] = method; else delete next[sellerId]
  commit({ deliverySelections: next })
}
export function clearCart() { commit({ items: [], savedItems: [], deliverySelections: {} }) }
export function getCartTotal() { return snapshot.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) }
export function getCartItemsCount() { return snapshot.items.reduce((sum, item) => sum + item.quantity, 0) }