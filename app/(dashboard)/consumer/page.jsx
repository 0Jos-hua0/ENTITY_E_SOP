'use client';

import { useState, useEffect } from 'react';
import EntityTree from '@/components/tree/EntityTree';
import EntityDetail from '@/components/detail/EntityDetail';

export default function ConsumerDashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      })
      .then(data => {
        const list = Array.isArray(data) ? data : data.items || data.entities || [];
        setProjects(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectProject = (project) => {
    setSelectedProjectId(project.id);
    sessionStorage.setItem('ktern_project_id', project.id);
    setSelectedEntity(null);
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-[#0F172A]">Published Content Library</h2>
        </div>
        
        <div className="flex-1 overflow-auto border-r border-gray-100">
          {!selectedProjectId ? (
            <div className="p-4 space-y-3">
              {loading && <div className="text-sm text-gray-500">Loading published content...</div>}
              {!loading && projects.map(p => (
                <div 
                  key={p.id}
                  onClick={() => handleSelectProject(p)}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-[#e13f00] hover:bg-orange-50 transition-colors bg-white shadow-sm"
                >
                  <div className="font-medium text-gray-900 mb-1">{p.name || p.displayId}</div>
                  <div className="text-xs text-gray-500">ID: {p.id}</div>
                </div>
              ))}
              {!loading && projects.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-8">No published content available.</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {projects.find(p => p.id === selectedProjectId)?.name || 'Selected Project'}
                </span>
                <button 
                  onClick={() => setSelectedProjectId(null)}
                  className="text-xs text-[#e13f00] hover:underline"
                >
                  Back to Library
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <EntityTree 
                  projectId={selectedProjectId} 
                  onSelectEntity={setSelectedEntity} 
                  selectedEntityId={selectedEntity?.id} 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-2/3 bg-[#F8FAFC] flex flex-col">
        <EntityDetail entity={selectedEntity} role="consumer" />
      </div>
    </div>
  );
}
