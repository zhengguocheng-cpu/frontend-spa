import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { SpinLoading } from 'antd-mobile'

// 使用懒加载提高性能
const Home = lazy(() => import('../pages/Home'))
const GameRoom = lazy(() => import('../pages/GameRoom'))
const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const RoomList = lazy(() => import('../pages/RoomList'))
const Profile = lazy(() => import('../pages/Profile'))
const Leaderboard = lazy(() => import('../pages/Leaderboard'))
const Feedback = lazy(() => import('../pages/Feedback'))
const NotFound = lazy(() => import('../pages/NotFound'))

const RequireAuth = lazy(() => import('../components/RequireAuth'))

// 加载中组件
const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <SpinLoading style={{ '--size': '48px' }} />
  </div>
)

// 路由配置 - 移动端扁平路由结构
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<Loading />}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<Loading />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<Loading />}>
        <Register />
      </Suspense>
    ),
  },
  {
    path: '/rooms',
    element: (
      <Suspense fallback={<Loading />}>
        <RequireAuth>
          <RoomList />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '/game/:roomId',
    element: (
      <Suspense fallback={<Loading />}>
        <RequireAuth>
          <GameRoom />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '/profile',
    element: (
      <Suspense fallback={<Loading />}>
        <RequireAuth>
          <Profile />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '/leaderboard',
    element: (
      <Suspense fallback={<Loading />}>
        <RequireAuth>
          <Leaderboard />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '/feedback',
    element: (
      <Suspense fallback={<Loading />}>
        <RequireAuth>
          <Feedback />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<Loading />}>
        <NotFound />
      </Suspense>
    ),
  },
])

// 导出路由提供者组件
export function Router() {
  return <RouterProvider router={router} />
}