import { db, getSetting, setSetting } from './db'
import { isoDate } from './time'
import type { Entry, Kid, Menu, Stage } from './types'

interface Backup {
  app: 'little-rhythm'
  version: number
  exported: string
  kids: Kid[]
  entries: Entry[]
  menu?: Menu
  /** version 1 kept the potty stage separately */
  stage?: Record<string, Stage>
}

/** Download every kid, entry and the menu as one JSON file. */
export async function downloadBackup() {
  const data: Backup = {
    app: 'little-rhythm',
    version: 2,
    exported: new Date().toISOString(),
    kids: await db.kids.toArray(),
    entries: await db.entries.toArray(),
    menu: await getSetting<Menu>('menu'),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `little-rhythm-backup-${isoDate()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  await setSetting('lastBackup', Date.now())
}

export async function readBackup(file: File): Promise<Backup> {
  const v = JSON.parse(await file.text())
  if (v?.app !== 'little-rhythm' || !Array.isArray(v.entries)) throw new Error('Not a Little Rhythm backup')
  return v as Backup
}

/** Replace everything on this device with the backup. Works with backups from the first (non-React) version too. */
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', db.entries, db.kids, db.settings, async () => {
    await db.entries.clear()
    await db.entries.bulkAdd(b.entries)
    if (Array.isArray(b.kids)) {
      await db.kids.clear()
      for (const k of b.kids) {
        const stage = k.stage ?? b.stage?.[k.id]
        await db.kids.put({ ...k, ...(stage ? { stage } : {}) })
      }
    }
    if (b.menu) await setSetting('menu', b.menu)
  })
}

export async function wipeAll() {
  await db.delete()
  location.reload()
}
