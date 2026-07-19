'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: GridIcon },
  { href: '/heatmap', label: 'Live Map', icon: MapIcon },
  { href: '/alerts', label: 'Alerts', icon: AlertIcon },
  { href: '/permits', label: 'Permits', icon: PermitIcon },
  { href: '/intelligence', label: 'Intel', icon: BrainIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden md:flex fixed left-0 top-[48px] bottom-0 w-[72px] bg-steel border-r border-border flex-col items-center py-4 gap-1 z-40">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center justify-center w-14 h-14 rounded-sm
                transition-all duration-150 group relative
                ${isActive
                  ? 'bg-phosphor-dim text-phosphor'
                  : 'text-dim-text hover:text-bright-text hover:bg-steel-light'
                }
              `}
            >
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-phosphor rounded-r" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-mono font-medium mt-1 uppercase tracking-wider">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[56px] bg-steel border-t border-border flex items-center justify-around z-40">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center min-w-[52px] h-full ${
                isActive ? 'text-phosphor' : 'text-dim-text'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[8px] font-mono mt-0.5 uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

// ── Icon Components ──

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function PermitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
      <line x1="10" y1="14" x2="10" y2="17" />
      <line x1="14" y1="14" x2="14" y2="17" />
    </svg>
  );
}
