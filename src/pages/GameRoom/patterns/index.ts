/**
 * 设计模式导出
 * 集中导出所有设计模式实现
 */

// 命令模式
export {
  PlayCardsCommand,
  PassCommand,
  BidCommand,
  CommandManager,
} from './GameCommands'

// 策略模式
export type { AutoPlayStrategy, AutoPlayContext } from './AutoPlayStrategies'
export {
  FullHandStrategy,
  TimeoutStrategy,
  NoValidCardsStrategy,
  AutoPlayStrategyManager,
} from './AutoPlayStrategies'

// 工厂模式
export type { EventHandler, EventContext } from './EventHandlerFactory'
export {
  PlayerJoinedHandler,
  PlayerLeftHandler,
  CardsPlayedHandler,
  EventHandlerFactory,
} from './EventHandlerFactory'

// 状态模式
export type { GameState, GameStateContext } from './GameStateMachine'
export {
  WaitingState,
  BiddingState,
  PlayingState,
  FinishedState,
  GameStateMachine,
} from './GameStateMachine'

// 观察者模式
export type { GameObserver, GameEvent } from './GameEventObserver'
export {
  ScoreChangeObserver,
  GameStateObserver,
  ChatMessageObserver,
  GameHistoryObserver,
  GameEventSubject,
  useGameEventSubject,
} from './GameEventObserver'
