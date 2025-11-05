import { configureStore } from '@reduxjs/toolkit'
import gameReducer from './slices/gameSlice'
import roomReducer from './slices/roomSlice'

export const store = configureStore({
  reducer: {
    game: gameReducer,
    room: roomReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略 Socket 实例的序列化检查
        ignoredActions: ['game/setSocket'],
        ignoredPaths: ['game.socket'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
