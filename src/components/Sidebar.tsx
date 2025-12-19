import { useEffect, useState } from 'react';
import { Home, Store, Timer, FileText, Shield, Settings, ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Wallet, Building2 } from 'lucide-react';

type SidebarProps = {
  currentView: string;
  onNavigate: (view: string) => void;
  userRole?: string | null;
  mobileOpen?: boolean;
  onClose?: () => void;
};

type IconComponent = React.ComponentType<{ className?: string }>;
type NavItem = {
  key: string;
  label: string;
  Icon: IconComponent;
  roles?: Array<string>; // if provided, restrict to these roles
};

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', Icon: Home },
  { key: 'pos', label: 'POS', Icon: Store },
  { key: 'kitchen', label: 'Kitchen', Icon: Timer },
  { key: 'live_shows', label: 'Live Shows', Icon: FileText },
  { key: 'live_shows_all', label: 'All Live Shows', Icon: List },
  { key: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { key: 'expenses', label: 'Expenses', Icon: Wallet, roles: ['admin', 'manager'] },
  { key: 'vendors', label: 'Vendors', Icon: Building2, roles: ['admin', 'manager'] },
  { key: 'kitchen_admin', label: 'Kitchen Admin', Icon: Shield, roles: ['admin'] },
  { key: 'admin', label: 'Admin', Icon: Shield, roles: ['admin'] },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

const LS_KEY = 'ui:sidebar:collapsed';

export default function Sidebar({ currentView, onNavigate, userRole, mobileOpen = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === 'true') setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch {}
      return next;
    });
  }

  const items = NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    const role = (userRole || '').toLowerCase();
    return item.roles.includes(role);
  });

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const asideBase = `border-r border-slate-200 bg-white flex flex-col ${collapsed ? 'w-16' : 'w-56'}`;
  const asideDesktop = `h-screen sticky top-0 ${asideBase}`;
  const asideMobile = `fixed inset-y-0 left-0 z-50 h-screen shadow-lg ${asideBase}`;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          aria-hidden="true"
          onClick={() => onClose && onClose()}
        />
      )}
      <aside className={`${mobileOpen ? asideMobile : asideDesktop}`} role="navigation" aria-label="Main navigation">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className={`font-semibold text-slate-700 ${collapsed ? 'sr-only' : ''}`}>Menu</div>
          <button
            type="button"
          onClick={mobileOpen && isMobile ? (onClose || toggleCollapsed) : toggleCollapsed}
            className="text-slate-600 hover:text-slate-900"
          title={mobileOpen && isMobile ? 'Close' : (collapsed ? 'Expand' : 'Collapse')}
          >
          {mobileOpen && isMobile ? (
            <ChevronLeft className="w-5 h-5" />
          ) : collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.Icon;
            const active = item.key === currentView;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${active ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-700'}`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className={`${collapsed ? 'sr-only' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
