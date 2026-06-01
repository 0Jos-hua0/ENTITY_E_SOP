import TopNav from '@/components/layout/TopNav';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <TopNav />
      <main className="h-[calc(100vh-64px)]">
        {children}
      </main>
    </div>
  );
}
