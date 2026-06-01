'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EntityTree from '@/components/tree/EntityTree';
import EntityDetail from '@/components/detail/EntityDetail';

export default function AdminWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');
  
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [projectName, setProjectName] = useState('Loading...');

  useEffect(() => {
    if (!projectId) {
      router.push('/admin');
      return;
    }
    
    // Fetch project name
    fetch(`/api/projects`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.items || data.entities || [];
        const proj = list.find(p => p.id === projectId);
        if (proj) setProjectName(proj.name || proj.displayId);
      })
      .catch(console.error);
  }, [projectId, router]);

  if (!projectId) return null;

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Tree */}
      <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="font-semibold text-sm text-gray-800 truncate">
            {projectName}
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase font-bold">Template</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <EntityTree 
            projectId={projectId} 
            onSelectEntity={setSelectedEntity} 
            selectedEntityId={selectedEntity?.id} 
          />
        </div>
      </div>

      {/* Right Panel - Detail */}
      <div className="w-2/3 bg-[#F8FAFC] flex flex-col h-full overflow-hidden">
        <EntityDetail entity={selectedEntity} role="admin" />
      </div>
    </div>
  );
}
