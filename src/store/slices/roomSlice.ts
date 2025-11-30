import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Player {
  id: string
  name: string
  avatar: string
  isReady?: boolean
  isOnline?: boolean
}

export interface Room {
  id: string
  name: string
  players: Player[]
  maxPlayers: number
  status: 'waiting' | 'playing' | 'finished'
  createdAt?: string
}

interface RoomState {
  rooms: Room[]
  currentRoom: Room | null
  loading: boolean
  error: string | null
}

const initialState: RoomState = {
  rooms: [],
  currentRoom: null,
  loading: false,
  error: null,
}

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setRooms: (state, action: PayloadAction<Room[]>) => {
      state.rooms = action.payload
      state.loading = false
      state.error = null
    },
    setCurrentRoom: (state, action: PayloadAction<Room | null>) => {
      state.currentRoom = action.payload
    },
    updateRoom: (state, action: PayloadAction<Room>) => {
      const index = state.rooms.findIndex((r) => r.id === action.payload.id)
      if (index !== -1) {
        state.rooms[index] = action.payload
      }
      if (state.currentRoom?.id === action.payload.id) {
        state.currentRoom = action.payload
      }
    },
    addRoom: (state, action: PayloadAction<Room>) => {
      state.rooms.push(action.payload)
    },
    removeRoom: (state, action: PayloadAction<string>) => {
      state.rooms = state.rooms.filter((r) => r.id !== action.payload)
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.loading = false
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  setRooms,
  setCurrentRoom,
  updateRoom,
  addRoom,
  removeRoom,
  setLoading,
  setError,
  clearError,
} = roomSlice.actions

export default roomSlice.reducer
