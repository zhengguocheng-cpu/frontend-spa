/**
 * Hook for auto-play logic (timeout, full-hand, hint)
 */

import { useEffect, useRef } from 'react'
import { CardHintHelper } from '@/utils/cardHintHelper'

interface UseAutoPlayOptions {
  isMyTurn: boolean
  canPass: boolean
  myCards: string[]
  lastPlayedCards: any
  turnTimer: number
  biddingTimer: number
  showBiddingUI: boolean
  handlePass: () => void
  handleBid: (bid: boolean) => void
  doPlayCards: (cards: string[]) => void
  addChatMessage: (name: string, msg: string) => void
  closeBiddingUI: () => void
}

export function useAutoPlay(options: UseAutoPlayOptions) {
  const {
    isMyTurn,
    canPass,
    myCards,
    lastPlayedCards,
    turnTimer,
    biddingTimer,
    showBiddingUI,
    handlePass,
    handleBid,
    doPlayCards,
    addChatMessage,
    closeBiddingUI,
  } = options

  const autoFullHandPlayedRef = useRef(false)
  const autoFollowHintAppliedRef = useRef(false)

  // 重置自动出牌标记
  useEffect(() => {
    if (isMyTurn) {
      CardHintHelper.resetHintIndex()
      autoFullHandPlayedRef.current = false
      autoFollowHintAppliedRef.current = false
    }
  }, [isMyTurn])

  // 自动整手出牌
  useEffect(() => {
    if (!isMyTurn) return
    if (!myCards || myCards.length === 0) return
    if (autoFullHandPlayedRef.current) return

    const fullHandPattern = CardHintHelper.getFullHandIfSinglePattern(myCards)
    if (!fullHandPattern || fullHandPattern.length !== myCards.length) return

    const lastCards: string[] | null = !canPass
      ? null
      : lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null

    const canPlayFullHand = CardHintHelper.canFullHandBeatLast(fullHandPattern, lastCards)
    if (!canPlayFullHand) return

    console.log('[AutoFullHand] 满足整手出牌条件，准备自动出牌:', fullHandPattern)
    autoFullHandPlayedRef.current = true

    setTimeout(() => {
      console.log('[AutoFullHand] 执行整手出牌')
      doPlayCards(fullHandPattern)
    }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, myCards, lastPlayedCards, canPass])

  // 自动应用跟牌提示
  useEffect(() => {
    if (!isMyTurn) return
    if (!canPass) return
    if (autoFollowHintAppliedRef.current) return
    if (!myCards || myCards.length === 0) return

    const hasLastCards =
      !!lastPlayedCards &&
      !!lastPlayedCards.cards &&
      lastPlayedCards.cards.length > 0
    if (!hasLastCards) return

    const lastCards = lastPlayedCards!.cards as string[]
    const hint = CardHintHelper.getHint(myCards, lastCards)
    if (!hint || hint.length === 0) return

    autoFollowHintAppliedRef.current = true
    // 不自动选牌，让玩家自己操作
  }, [isMyTurn, canPass, myCards, lastPlayedCards])

  // 抢地主倒计时超时
  useEffect(() => {
    if (biddingTimer !== 0) return
    if (!showBiddingUI) return

    console.log('[AutoBid] 抢地主超时，自动选择不抢')
    closeBiddingUI()
    handleBid(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biddingTimer, showBiddingUI])

  // 自动出牌（倒计时超时）
  useEffect(() => {
    if (!isMyTurn) return
    if (turnTimer !== 0) return

    console.log('[AutoPlay] 倒计时到期，准备自动出牌', {
      canPass,
      myCardsCount: myCards.length,
      lastPlayedCards,
    })

    if (canPass) {
      console.log('[AutoPlay] 选择不出')
      handlePass()
    } else {
      if (myCards.length === 0) {
        console.warn('[AutoPlay] 没有手牌')
        return
      }

      const lastCards: string[] | null =
        lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
          ? lastPlayedCards.cards
          : null

      const autoHint = CardHintHelper.getHint(myCards, lastCards)
      console.log('[AutoPlay] 自动提示结果:', autoHint)

      if (autoHint && autoHint.length > 0) {
        console.log('[AutoPlay] 自动出牌:', autoHint)
        doPlayCards(autoHint)
        addChatMessage('系统', '已为你自动出一手推荐牌')
      } else {
        const minCard = myCards[0]
        if (minCard) {
          console.log('[AutoPlay] 兜底出最小牌:', minCard)
          doPlayCards([minCard])
          addChatMessage('系统', '已为你自动出一张最小的牌')
        } else {
          console.error('[AutoPlay] 没有可出的牌')
          addChatMessage('系统', '已为你自动判定为没有可出的牌')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimer, isMyTurn, canPass, myCards, lastPlayedCards])

  // 自动"没有可出牌时帮点不出"
  useEffect(() => {
    if (!isMyTurn || !canPass) return
    if (!myCards || myCards.length === 0) return

    const lastCards: string[] | null =
      lastPlayedCards && lastPlayedCards.cards && lastPlayedCards.cards.length > 0
        ? lastPlayedCards.cards
        : null

    if (!lastCards) return

    const allHints = CardHintHelper.getAllHints(myCards, lastCards)

    if (!allHints || allHints.length === 0) {
      setTimeout(() => {
        if (isMyTurn && canPass) {
          handlePass()
          addChatMessage('系统', '没有可出的牌，已自动选择不出')
        }
      }, 1000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, canPass, myCards, lastPlayedCards])

  return {
    autoFullHandPlayedRef,
    autoFollowHintAppliedRef,
  }
}
