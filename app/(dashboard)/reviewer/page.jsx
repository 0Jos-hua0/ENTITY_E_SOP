'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewerDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/projects')
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      })
      .then(data => {
        const list = Array.isArray(data) ? data : data.items || data.entities || [];
        // Only show projects created by SMEs (SOP_INSTANCE)
        const instances = list.filter(p => p.methodology === 'SOP_INSTANCE');
        setProjects(instances);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleOpenWorkspace = (projectId) => {
    sessionStorage.setItem('ktern_project_id', projectId);
    router.push(`/reviewer/workspace?projectId=${projectId}`);
  };

  return (
    <div className="h-full p-8 overflow-auto bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto space-y-12">
        <section>
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Projects Awaiting Review</h2>
              <p className="text-gray-500 text-sm mt-1">Select a project to review its pending entities.</p>
            </div>
            <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200">
              <span className="font-semibold text-gray-900">{projects.length}</span> Total Projects
            </div>
          </div>

          {loading ? (
            <div className="text-gray-500">Loading assignments...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 bg-white border border-gray-200 border-dashed rounded-xl text-center">
              <span className="text-gray-500">You don't have any projects assigned.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => (
                <div 
                  key={p.id}
                  onClick={() => handleOpenWorkspace(p.id)}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#e13f00] transition-all flex flex-col cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Active SOP</span>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 line-clamp-1 mb-1 group-hover:text-[#e13f00] transition-colors">{p.name || p.displayId}</h3>
                  <p className="text-xs text-gray-500 mb-4">{p.description || 'No description'}</p>
                  
                  <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                    ID: {p.id.split('-')[0]}
                    <span className="text-[#e13f00] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open Review Workspace →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
