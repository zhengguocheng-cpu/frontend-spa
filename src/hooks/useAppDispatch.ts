import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'

// 自定义 hooks，提供类型支持
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
