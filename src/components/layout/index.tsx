import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, theme, Avatar, Dropdown, Typography, Space, Tag } from 'antd';
import {
  HomeOutlined,
  LoginOutlined,
  UserAddOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { useSocketStatus } from '@/hooks/useSocketStatus';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const { user, logout } = useAuth();
  const status = useSocketStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const userMenu = (
    <Menu
      items={[
        {
          key: 'profile',
          icon: <UserOutlined />,
          label: '个人中心',
          onClick: () => navigate('/profile'),
        },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          onClick: () => {
            logout();
            navigate('/login');
          },
        },
      ]}
    />
  );

  const statusTag = (
    <Tag color={status.connected ? 'green' : status.reconnecting ? 'orange' : 'red'}>
      {status.connected ? '已连接' : status.reconnecting ? `重连中(${status.attempts})` : '未连接'}
    </Tag>
  );

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header>
        <div
          className="logo"
          style={{
            color: '#fff',
            fontWeight: 600,
            fontSize: 18,
            marginRight: 24,
            cursor: 'pointer',
          }}
          onClick={() => handleMenuClick('/')}
        >
          斗地主在线
        </div>
        <Space style={{ float: 'right' }} size="large">
          {statusTag}
          {user ? (
            <Dropdown overlay={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer', color: '#fff' }}>
                <Avatar>{user.avatar}</Avatar>
                <Text style={{ color: '#fff' }}>{user.name}</Text>
              </Space>
            </Dropdown>
          ) : (
            <Menu
              theme="dark"
              mode="horizontal"
              selectable={false}
              items={[
                {
                  key: 'login',
                  icon: <LoginOutlined />,
                  label: '登录',
                  onClick: () => handleMenuClick('/login'),
                },
                {
                  key: 'register',
                  icon: <UserAddOutlined />,
                  label: '注册',
                  onClick: () => handleMenuClick('/register'),
                },
              ]}
            />
          )}
        </Space>
        <Menu
          theme="dark"
          mode="horizontal"
          selectable={false}
          items={[
            {
              key: 'home',
              icon: <HomeOutlined />,
              label: <span>首页</span>,
              onClick: () => handleMenuClick('/'),
            },
            {
              key: 'rooms',
              icon: <TeamOutlined />,
              label: <span>房间列表</span>,
              onClick: () => handleMenuClick('/rooms'),
            },
            {
              key: 'login',
              icon: <LoginOutlined />,
              label: <span>登录</span>,
              onClick: () => handleMenuClick('/login'),
              style: user ? { display: 'none' } : undefined,
            },
            {
              key: 'register',
              icon: <UserAddOutlined />,
              label: <span>注册</span>,
              onClick: () => handleMenuClick('/register'),
              style: user ? { display: 'none' } : undefined,
            },
          ]}
        />
      </Header>
      <Content style={{ padding: '0 50px', marginTop: 16 }}>
        <div style={{ background: colorBgContainer, padding: 24, minHeight: 280 }}>
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>斗地主 SPA 2025 Created by Your Name</Footer>
    </Layout>
  );
}