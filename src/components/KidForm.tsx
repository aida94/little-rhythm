import { GENDERS, type KidDraft } from '../lib/kids'
import { isoDate } from '../lib/time'
import type { Gender } from '../lib/types'
import { ChipRow } from './ui'

interface Props {
  draft: KidDraft
  /** Called with only the fields that changed. */
  onChange: (patch: Partial<KidDraft>) => void
  onRemove?: () => void
  removeLabel?: string
}

/** Name, gender and date of birth for one kid. Used on the welcome screen and in Settings. */
export function KidForm({ draft, onChange, onRemove, removeLabel = 'Remove' }: Props) {
  const id = draft.id
  const genderLabel = GENDERS.find(([g]) => g === draft.gender)?.[1]
  return (
    <div className="kid-form">
      <div className="kid-form-h">
        <span className="avatar" style={{ background: draft.color }}>
          {draft.name.trim()[0]?.toUpperCase() ?? '?'}
        </span>
        <input
          type="text"
          id={`name-${id}`}
          value={draft.name}
          placeholder="Name"
          aria-label="Name"
          autoComplete="off"
          autoCapitalize="words"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {onRemove && (
          <button type="button" className="kid-remove" onClick={onRemove}>
            {removeLabel}
          </button>
        )}
      </div>
      <div className="field">
        <span>Gender</span>
        <ChipRow
          options={GENDERS.map(([, label]) => label)}
          value={genderLabel}
          onChange={(label) => onChange({ gender: GENDERS.find(([, l]) => l === label)?.[0] as Gender })}
        />
      </div>
      <div className="field">
        <label htmlFor={`birth-${id}`}>Date of birth</label>
        <input type="date" id={`birth-${id}`} value={draft.birth} max={isoDate()} onChange={(e) => onChange({ birth: e.target.value })} />
      </div>
    </div>
  )
}
