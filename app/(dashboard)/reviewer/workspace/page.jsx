'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EntityTree from '@/components/tree/EntityTree';
import EntityDetail from '@/components/detail/EntityDetail';
import StatusBadge from '@/components/shared/StatusBadge';

export default function ReviewerWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');
  
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [projectName, setProjectName] = useState('Loading...');
  const [viewMode, setViewMode] = useState('flat'); // 'flat' or 'tree'
  const [flatEntities, setFlatEntities] = useState([]);
  const [flatLoading, setFlatLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      router.push('/reviewer');
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

    // Fetch flat entities for list view
    setFlatLoading(true);
    fetch(`/api/projects/${projectId}/entities?limit=1000`)
      .then(res => res.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items || data.entities || []);
        // Filter to only show entities that need review
        const needsReview = items.filter(e => e.status === 'in_review');
        setFlatEntities(needsReview);
      })
      .catch(console.error)
      .finally(() => setFlatLoading(false));

  }, [projectId, router]);

  if (!projectId) return null;

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Navigation/List */}
      <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col gap-2">
          <div className="font-semibold text-sm text-gray-800 truncate">
            {projectName}
          </div>
          <div className="flex bg-white rounded border border-gray-200 p-0.5 mt-1">
            <button
              className={`flex-1 text-xs py-1 px-2 rounded-sm font-medium transition-colors ${viewMode === 'flat' ? 'bg-[#e13f00] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setViewMode('flat')}
            >
              Review List
            </button>
            <button
              className={`flex-1 text-xs py-1 px-2 rounded-sm font-medium transition-colors ${viewMode === 'tree' ? 'bg-[#e13f00] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setViewMode('tree')}
            >
              Full Tree
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {viewMode === 'tree' ? (
            <EntityTree 
              projectId={projectId} 
              onSelectEntity={setSelectedEntity} 
              selectedEntityId={selectedEntity?.id} 
            />
          ) : (
            <div className="space-y-2">
              {flatLoading && <div className="text-sm text-gray-500 p-2">Loading tasks...</div>}
              {!flatLoading && flatEntities.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 mt-2 mx-2">
                  You have no pending reviews in this project.
                </div>
              )}
              {!flatLoading && flatEntities.map(entity => (
                <div 
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedEntity?.id === entity.id ? 'border-[#e13f00] bg-orange-50' : 'border-gray-200 bg-white hover:border-[#e13f00]'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-gray-500">{entity.displayId}</span>
                    <StatusBadge status={entity.status} />
                  </div>
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {entity.values?.content || entity.values?.name || entity.entityType?.name || 'Unnamed Entity'}
                  </div>
                  {entity.values?.assigned_reviewer && (
                    <div className="text-[10px] text-blue-600 mt-1">@ {entity.values.assigned_reviewer}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Detail */}
      <div className="w-2/3 bg-[#F8FAFC] flex flex-col h-full overflow-hidden">
        <EntityDetail entity={selectedEntity} role="reviewer" />
      </div>
    </div>
  );
}
