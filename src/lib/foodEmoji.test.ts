import { describe, expect, it } from 'vitest'
import { cleanEmoji, firstEmoji, localEmoji } from './foodEmoji'

describe('localEmoji', () => {
  it('finds foods in the order they are written', () => {
    expect(localEmoji('Pasta with broccoli and cheese')).toBe('🍝🥦🧀')
    expect(localEmoji('Lunch: apples')).toBe('🍎')
  })
  it('prefers longer names and whole-word starts', () => {
    expect(localEmoji('sweet potato')).toBe('🍠')
    expect(localEmoji('watermelon')).toBe('🍉')
    expect(localEmoji('pineapple')).toBe('🍍')
    expect(localEmoji('peach')).toBe('🍑')
    expect(localEmoji('pancakes')).toBe('🥞')
  })
  it('keeps at most 3 and no repeats', () => {
    expect(localEmoji('apple, banana, pear, grapes, apple')).toBe('🍎🍌🍐')
    expect(localEmoji('something new')).toBe('')
  })
})

describe('cleanEmoji', () => {
  it('keeps only emoji', () => {
    expect(cleanEmoji('🍝 pasta 🥦🥦 ')).toBe('🍝🥦')
    expect(cleanEmoji(42)).toBe('')
    expect(firstEmoji('🍝🥦')).toBe('🍝')
  })
})
