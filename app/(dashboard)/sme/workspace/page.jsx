'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EntityTree from '@/components/tree/EntityTree';
import EntityDetail from '@/components/detail/EntityDetail';

export default function SMEWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');
  
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [projectName, setProjectName] = useState('Loading...');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!projectId) {
      router.push('/sme');
      return;
    }
    
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
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                if(!confirm('Simulate Excel Import? This will fire 3 POST /entities and PATCH /parent sequentially.')) return;
                setImporting(true);
                try {
                  const typesRes = await fetch(`/api/projects/${projectId}/entity-types`);
                  const types = await typesRes.json();
                  const type = types[0];
                  const validTypeId = type?.id || type?.typeId;
                  if (!validTypeId) throw new Error('No entity types found');

                  const contentAttr = type.attributes?.find(a => a.name === 'content' || a.name === 'name') || type.attributes?.[0];
                  const attrKey = contentAttr ? contentAttr.id : 'content';

                  const rows = ['Phase 1', 'Milestone 1', 'Deliverable 1'];
                  let lastId = null;
                  for (const row of rows) {
                      const res = await fetch(`/api/projects/${projectId}/entities`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ typeId: validTypeId, values: { [attrKey]: row } })
                      });
                      if (!res.ok) throw new Error('Create failed');
                      const newEntity = await res.json();
                      
                      if (lastId) {
                        await fetch(`/api/projects/${projectId}/entities/${newEntity.id}/parent`, {
                          method: 'PATCH',
                          headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ parentId: lastId })
                        });
                      }
                      lastId = newEntity.id;
                  }
                  alert('Excel Import API Loop Complete!');
                } catch(err) {
                  console.error(err);
                  alert('Import failed');
                } finally {
                  setImporting(false);
                }
              }}
              disabled={importing}
              className="text-xs text-green-700 bg-green-100 hover:bg-green-200 px-2 py-1 rounded disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import Excel'}
            </button>
          </div>
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
        <EntityDetail entity={selectedEntity} role="sme" />
      </div>
    </div>
  );
}
