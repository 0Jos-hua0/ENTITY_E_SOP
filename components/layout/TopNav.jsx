'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState('');

  useEffect(() => {
    const storedRole = sessionStorage.getItem('ktern_role');
    if (!storedRole) {
      router.push('/login');
    } else {
      setRole(storedRole);
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('ktern_role');
    // Also might want to hit a logout API if KTern supports it, but for now clear session and redirect
    router.push('/login');
  };

  if (!role) return null; // Don't render until role is known

  const isWorkspace = pathname.includes('/workspace');
  const dashboardPath = `/${role.toLowerCase()}`;

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold bg-gradient-to-r from-[#e13f00] to-[#9d0102] bg-clip-text text-transparent">
          KTern
        </div>
        <div className="h-6 w-px bg-gray-300"></div>
        <h1 className="text-lg font-medium text-[#0F172A]">SOP Platform</h1>
        {isWorkspace && (
          <>
            <div className="h-4 w-px bg-gray-300 ml-2"></div>
            <Link 
              href={dashboardPath}
              className="text-sm font-medium text-[#e13f00] hover:underline ml-2 flex items-center gap-1"
            >
              ← Back to Dashboard
            </Link>
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900">Shared User</p>
            <p className="text-gray-500 text-xs">msivaram@kaartech.com</p>
          </div>
          <span className="bg-orange-100 text-[#e13f00] text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {role}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-[#e13f00] font-medium transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
