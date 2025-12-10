/**
 * Hook for managing wallet score
 */

import { useState, useEffect, useRef } from 'react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { updatePlayers } from '@/store/slices/gameSlice'
import { fetchPlayerScore } from '../logic/walletHelper'

export function useWalletScore(user: any, leftPlayer: any, rightPlayer: any, players: any[]) {
  const [walletScore, setWalletScore] = useState<number | null>(null)
  const fetchedScorePlayerIdsRef = useRef<Set<string>>(new Set())
  const dispatch = useAppDispatch()

  const refreshWalletScore = async (): Promise<number | null> => {
    if (!user) {
      setWalletScore(null)
      return null
    }

    const scoreValue = await fetchPlayerScore(user.id)
    setWalletScore(scoreValue)
    return scoreValue
  }

  // 刷新当前用户的钱包积分
  useEffect(() => {
    if (!user) {
      setWalletScore(null)
      return
    }

    const controller = new AbortController()

    const run = async () => {
      try {
        await refreshWalletScore()
      } catch {
        // ignore
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [user])

  // 为左右玩家拉取积分
  useEffect(() => {
    const candidates = [leftPlayer, rightPlayer].filter(
      (p: any | null) =>
        p &&
        p.id &&
        (!p.score || typeof p.score !== 'number' || p.score <= 0) &&
        !fetchedScorePlayerIdsRef.current.has(p.id),
    ) as any[]

    if (!candidates.length) return

    const controller = new AbortController()

    const fetchScores = async () => {
      try {
        const updatedPlayers = [...players]

        for (const p of candidates) {
          try {
            fetchedScorePlayerIdsRef.current.add(p.id)
            const totalScore = await fetchPlayerScore(p.id)

            if (totalScore != null) {
              const idx = updatedPlayers.findIndex((x: any) => x.id === p.id)
              if (idx >= 0) {
                updatedPlayers[idx] = {
                  ...updatedPlayers[idx],
                  score: totalScore,
                }
              }
            }
          } catch {
            // 网络错误时忽略
          }
        }

        dispatch(updatePlayers(updatedPlayers as any))
      } catch {
        // ignore
      }
    }

    fetchScores()

    return () => {
      controller.abort()
    }
  }, [leftPlayer, rightPlayer, players, dispatch])

  // 将钱包积分写入sessionStorage
  useEffect(() => {
    if (walletScore == null) return
    try {
      sessionStorage.setItem('lastWalletScore', String(walletScore))
    } catch {
      // ignore storage error
    }
  }, [walletScore])

  return { walletScore, setWalletScore, refreshWalletScore }
}
