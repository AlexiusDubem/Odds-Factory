import { useCallback, useEffect, useState } from 'react'
import type { BacktestRecord } from '../types'

const STORAGE_KEY = 'odds-factory-backtests'

export function useBacktest() {
  const [records, setRecords] = useState<BacktestRecord[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setRecords(JSON.parse(stored))
      } catch {
        setRecords([])
      }
    }
  }, [])

  const save = useCallback((newRecords: BacktestRecord[]) => {
    setRecords(newRecords)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords))
  }, [])

  const addRecord = useCallback(
    (record: Omit<BacktestRecord, 'id' | 'recordedAt'>) => {
      const full: BacktestRecord = {
        ...record,
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
      }
      save([full, ...records])
      return full
    },
    [records, save]
  )

  const updateRecord = useCallback(
    (id: string, updates: Partial<BacktestRecord>) => {
      save(records.map((r) => (r.id === id ? { ...r, ...updates } : r)))
    },
    [records, save]
  )

  const clearRecords = useCallback(() => {
    save([])
  }, [save])

  const stats = {
    total: records.length,
    won: records.filter((r) => r.outcome === 'won').length,
    lost: records.filter((r) => r.outcome === 'lost').length,
    pending: records.filter((r) => r.outcome === 'pending').length,
    winRate:
      records.filter((r) => r.outcome !== 'pending').length > 0
        ? (records.filter((r) => r.outcome === 'won').length /
            records.filter((r) => r.outcome !== 'pending').length) *
          100
        : 0,
  }

  return { records, addRecord, updateRecord, clearRecords, stats }
}