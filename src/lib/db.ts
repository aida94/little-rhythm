import { Dexie, type EntityTable } from 'dexie'
import type { Entry, Kid, Menu } from './types'

interface Setting {
  key: string
  value: unknown
}

/**
 * All data lives in IndexedDB in this browser, on this device. Nothing is sent to a server.
 * Dexie is a small wrapper that makes IndexedDB easy to use and lets React re-render when data changes.
 */
export const db = new Dexie('little-rhythm') as Dexie & {
  entries: EntityTable<Entry, 'id'>
  kids: EntityTable<Kid, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  entries: 'id, kid, start',
  kids: 'id',
  settings: 'key',
})


/** Remove a kid and everything logged for them. */
export async function removeKid(id: string) {
  await db.transaction('rw', db.kids, db.entries, async () => {
    await db.entries.where('kid').equals(id).delete()
    await db.kids.delete(id)
  })
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value })

export const saveMenu = (menu: Menu) => setSetting('menu', menu)

/** Ask the browser to keep this data even when the device runs low on space. */
export async function askPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* not supported: data is still saved, just evictable */
  }
}
