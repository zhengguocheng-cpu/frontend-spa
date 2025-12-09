/**
 * BiddingControls - 斗地主抢地主控制组件
 * 斗地主特定的抢地主 UI
 */

import { Button } from 'antd-mobile'
import './style.css'

export interface BiddingControlsProps {
  visible: boolean
  timer: number
  onBid: (bid: boolean) => void
}

export function BiddingControls(props: BiddingControlsProps) {
  const { visible, timer, onBid } = props

  if (!visible) {
    return null
  }

  return (
    <div className="bidding-actions">
      <div className="bidding-timer">{timer}</div>
      <div className="bidding-buttons">
        <Button 
          color="warning" 
          size="large"
          onClick={() => onBid(true)}
          className="bidding-btn bidding-btn-yes"
        >
          抢地主
        </Button>
        <Button 
          color="default" 
          size="large"
          onClick={() => onBid(false)}
          className="bidding-btn bidding-btn-no"
        >
          不抢
        </Button>
      </div>
    </div>
  )
}
