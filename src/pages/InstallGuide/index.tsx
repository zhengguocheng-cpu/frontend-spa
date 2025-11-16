import { Button } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import './style.css'

export default function InstallGuide() {
  const navigate = useNavigate()

  return (
    <div className="install-page">
      <div className="install-card">
        <div className="install-header">
          <button className="install-back" type="button" onClick={() => navigate(-1)}>
            返回
          </button>
          <div className="install-header-main">
            <h1 className="install-title">安装到桌面</h1>
            <p className="install-subtitle">把欢乐斗地主装成「桌面应用」，下次一键打开。</p>
          </div>
        </div>

        <div className="install-section">
          <h2 className="install-section-title">通用步骤</h2>
          <ol className="install-steps">
            <li>用系统浏览器打开本站： https://www.games365.fun</li>
            <li>等待页面完全加载后，点击浏览器菜单按钮（⋯ 或 ☰）。</li>
            <li>在菜单中找到「安装应用」或「添加到主屏幕」等选项。</li>
            <li>按提示完成安装，回到桌面或应用列表找到「斗地主」图标。</li>
          </ol>
        </div>

        <div className="install-section">
          <h2 className="install-section-title">Edge 浏览器（华为 / 安卓）</h2>
          <ol className="install-steps">
            <li>在 Edge 中打开 https://www.games365.fun。</li>
            <li>看到提示「安装应用」时点击安装。</li>
            <li>安装完成后，在 Edge 菜单 &gt; 应用 / 已安装的应用 中可以找到「斗地主」。</li>
            <li>如需桌面图标，可在系统的应用抽屉中找到「斗地主」，长按拖到桌面。</li>
          </ol>
        </div>

        <div className="install-section">
          <h2 className="install-section-title">找不到图标怎么办？</h2>
          <ul className="install-steps">
            <li>在手机主屏幕上上滑，打开「所有应用」列表，搜索「斗地主」。</li>
            <li>检查桌面设置中是否开启「新应用自动添加到桌面」。</li>
            <li>如果还是找不到，可以先卸载当前安装记录，然后换一个浏览器（如华为浏览器 / Chrome）重新安装。</li>
          </ul>
        </div>

        <div className="install-footer">
          <Button color="primary" block onClick={() => navigate('/rooms')}>
            返回游戏大厅
          </Button>
        </div>
      </div>
    </div>
  )
}
