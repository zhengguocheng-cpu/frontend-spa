import { Result } from 'antd'

export default function NotFound() {
  return (
    <div className="notfound-page">
      <Result
        status="404"
        title="404"
        subTitle="抱歉，您访问的页面不存在或已被移动。"
      />
    </div>
  )
}
