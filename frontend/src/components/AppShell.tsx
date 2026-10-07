import { NavLink, Outlet } from 'react-router-dom';
import { initials } from '../utils/format';
import { IconChat, IconDashboard, IconMail, IconMegaphone, IconSettings, IconSpark, IconUsers } from './Icons';
import { useShop } from './ShopContext';

const NAV = [
  { to: '/tong-quan', label: 'Tổng quan', icon: IconDashboard },
  { to: '/hop-thoai', label: 'Hộp thoại', icon: IconChat, badge: 12 },
  { to: '/marketing', label: 'Marketing', icon: IconMegaphone },
  { to: '/cau-hinh-ai', label: 'Cấu hình AI', icon: IconSpark },
  { to: '/cai-dat', label: 'Cài đặt', icon: IconSettings },
];

const PREVIEW_NAV = [
  { to: '/khach-hang/chat', label: 'Khung chat khách', icon: IconChat },
  { to: '/khach-hang/chuyen-tiep', label: 'Chuyển tiếp nhân viên', icon: IconUsers },
  { to: '/khach-hang/email', label: 'Email cá nhân hoá', icon: IconMail },
];

const navClass = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' active' : ''}`;

export function AppShell() {
  const shop = useShop();

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/tong-quan" className="brand"><img src="/tendly-logo.png" alt="Tendly" /></NavLink>
        <nav className="nav-group">
          {NAV.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon />
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="nav-section-label">Xem trước phía khách</div>
        <nav className="nav-group">
          {PREVIEW_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={(s) => navClass(s) + ' sub'}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="avatar-sm">{shop.logo ? <img src={shop.logo} alt="" /> : initials(shop.name)}</div>
          <div className="who">
            <div className="name">{shop.name}</div>
            <div className="role">Chủ shop</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
