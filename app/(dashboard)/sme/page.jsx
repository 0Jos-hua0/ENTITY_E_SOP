'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SMEDashboard() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Clone Modal State
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [sourceTemplate, setSourceTemplate] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const list = Array.isArray(data) ? data : data.items || data.entities || [];
      
      setTemplates(list.filter(p => p.methodology === 'SOP_TEMPLATE'));
      setInstances(list.filter(p => p.methodology !== 'SOP_TEMPLATE'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWorkspace = (projectId) => {
    sessionStorage.setItem('ktern_project_id', projectId);
    router.push(`/sme/workspace?projectId=${projectId}`);
  };

  const handleCloneTemplate = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !sourceTemplate) return;

    setCreating(true);

    const remapIds = (val, idMap) => {
      if (typeof val === 'string') return idMap[val] ?? val;
      if (Array.isArray(val)) return val.map(v => remapIds(v, idMap));
      if (val && typeof val === 'object')
        return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, remapIds(v, idMap)]));
      return val;
    };

    try {
      // 1. Create project
      const slug = newProjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const projRes = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(), description: `Cloned from ${sourceTemplate.name}`, methodology: 'SOP_INSTANCE', slug
        })
      });
      if (!projRes.ok) throw new Error(`Failed to create project: ${await projRes.text()}`);
      const newProj = await projRes.json();
      
      // 2. Fetch types and chain
      const [typesRes, chainRes] = await Promise.all([
        fetch(`/api/projects/${sourceTemplate.id}/entity-types`),
        fetch(`/api/projects/${sourceTemplate.id}/entity-types/hierarchy/chain`)
      ]);
      if (!typesRes.ok) throw new Error('Failed to fetch types');
      const typesToClone = await typesRes.json();
      const hierarchyChain = chainRes.ok ? await chainRes.json() : null;

      const typeIdMap = {};
      const sourceTypeDetails = {};

      // 3. Create Entity Types in NEW project with embedded attributes
      for (const t of typesToClone) {
        const detailRes = await fetch(`/api/projects/${sourceTemplate.id}/entity-types/${t.id}`);
        const tDetail = detailRes.ok ? await detailRes.json() : t;
        sourceTypeDetails[t.id] = tDetail;
        const sourceAttrs = tDetail.attributes || [];

        // Note: we embed attributes so they retain their original IDs
        const ntRes = await fetch(`/api/projects/${newProj.id}/entity-types`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: t.name,
            idPrefix: t.idPrefix || t.name.substring(0, 3).toUpperCase(),
            hasStatusWorkflow: t.hasStatusWorkflow || false,
            statusWorkflow: t.statusWorkflow || [],
            attributes: sourceAttrs.map(a => ({
              id: a.id, name: a.name, type: a.type || a.dataType || 'STRING', required: !!a.required,
              ...(a.options !== undefined ? { options: a.options } : {})
            }))
          })
        });
        
        if (!ntRes.ok) {
           console.error('[Clone] Failed to create type:', await ntRes.text());
           continue;
        }
        const newType = await ntRes.json();
        typeIdMap[t.id] = newType.id;

        // 4. Enable Hierarchy
        if (tDetail.hasHierarchy) {
          await fetch(`/api/projects/${newProj.id}/entity-types/${newType.id}/hierarchy/enable`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'heterogeneous' })
          });
        }
      }

      // 5. Remap hierarchyConfig
      for (const [srcTypeId, newTypeId] of Object.entries(typeIdMap)) {
        const tDetail = sourceTypeDetails[srcTypeId];
        if (!tDetail?.hierarchyConfig) continue;
        const remapped = remapIds(tDetail.hierarchyConfig, typeIdMap);
        await fetch(`/api/projects/${newProj.id}/entity-types/${newTypeId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hierarchyConfig: remapped })
        });
      }

      // 6. Pre-fetch flat entities to easily map src.values
      const allRes = await fetch(`/api/projects/${sourceTemplate.id}/entities?limit=2000`);
      const allData = allRes.ok ? await allRes.json() : [];
      const allEntities = Array.isArray(allData) ? allData : allData.items || allData.entities || [];
      const entityInfoMap = {};
      allEntities.forEach(e => { entityInfoMap[e.id] = e; });

      const entityIdMap = {};

      const cloneNode = async (srcId, newParentId = null) => {
         const src = entityInfoMap[srcId];
         if (!src) return;

         const newTypeId = typeIdMap[src.typeId || src.entityType?.id];
         if (!newTypeId) return;

         // Pass original values (Attribute IDs match perfectly because we preserved them!)
         // Ensure it is an object to prevent 400 Bad Request
         const eRes = await fetch(`/api/projects/${newProj.id}/entities`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ typeId: newTypeId, values: src.values || {} })
         });
         
         if (!eRes.ok) {
             console.error('[Clone] Failed to POST entity:', await eRes.text());
             return;
         }
         const newEntity = await eRes.json();
         entityIdMap[srcId] = newEntity.id;

         // Set Parent
         if (newParentId) {
             const pRes = await fetch(`/api/projects/${newProj.id}/entities/${newEntity.id}/parent`, {
                 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ parentId: newParentId })
             });
             if (!pRes.ok) {
                 const errText = await pRes.text();
                 console.warn('[Clone] Failed PATCH /parent, trying PUT:', errText);
                 await fetch(`/api/projects/${newProj.id}/entities/${newEntity.id}/parent`, {
                     method: 'PUT', headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ parentId: newParentId })
                 });
             }
         }

         // Recurse Children (Properly awaited!)
         const childRes = await fetch(`/api/projects/${sourceTemplate.id}/entities/${srcId}/children`);
         if (childRes.ok) {
             const childData = await childRes.json();
             const children = Array.isArray(childData) ? childData : childData.items || childData.entities || [];
             for (const child of children) {
                 await cloneNode(child.id, newEntity.id);
             }
         }
      };

      // 7. Get roots and start recursive cloning
      const rootsRes = await fetch(`/api/projects/${sourceTemplate.id}/entities/hierarchy/roots?limit=100&offset=0`);
      if (rootsRes.ok) {
         const rootsData = await rootsRes.json();
         const roots = Array.isArray(rootsData) ? rootsData : rootsData.items || rootsData.entities || [];
         for (const root of roots) {
             await cloneNode(root.id, null);
         }
      }

      setShowCloneModal(false);
      setNewProjectName('');
      handleOpenWorkspace(newProj.id);
    } catch (err) {
      console.error('[Clone] Fatal error:', err);
      alert('Error creating project: ' + err.message);
      setCreating(false);
    }
  };

  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${projectName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setInstances(prev => prev.filter(p => p.id !== projectId));
      } else {
        alert('Failed to delete project');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting project');
    }
  };

  return (
    <div className="h-full p-8 overflow-auto bg-[#F8FAFC]">
      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Create SOP from Template</h2>
            <p className="text-sm text-gray-500 mb-4">You are using <b>{sourceTemplate?.name}</b> as the structural foundation.</p>
            <form onSubmit={handleCloneTemplate}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Project Name</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="w-full border rounded px-3 py-2 outline-none focus:border-[#e13f00]"
                  placeholder="e.g. Q3 Server Migration"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowCloneModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="px-4 py-2 bg-[#e13f00] text-white rounded hover:bg-[#c23600] disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12">
        {/* Section 1: Create New from Template */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create New SOP</h2>
            <p className="text-gray-500 text-sm mt-1">Select an Admin-approved template to start a new project.</p>
          </div>
          
          {loading ? (
            <div className="text-gray-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 bg-white border border-gray-200 border-dashed rounded-xl text-center">
              <span className="text-gray-500">No SOP Templates available yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map(t => (
                <div 
                  key={t.id}
                  onClick={() => { setSourceTemplate(t); setShowCloneModal(true); }}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#e13f00] transition-all cursor-pointer group flex flex-col h-40"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Template</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{t.name || t.displayId}</h3>
                  <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                    ID: {t.id.split('-')[0]}
                    <span className="text-[#e13f00] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Use Template →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Edit Existing */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Existing Projects</h2>
            <p className="text-gray-500 text-sm mt-1">Resume work on active SOP instances or create new versions.</p>
          </div>

          {loading ? (
            <div className="text-gray-500">Loading instances...</div>
          ) : instances.length === 0 ? (
            <div className="p-8 bg-white border border-gray-200 border-dashed rounded-xl text-center">
              <span className="text-gray-500">You don't have any active projects yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instances.map(p => (
                <div 
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all flex flex-col relative group"
                >
                  <button 
                    onClick={(e) => handleDeleteProject(e, p.id, p.name || p.displayId)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Project"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                  <div className="flex justify-between items-start mb-2 pr-6">
                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Active SOP</span>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 line-clamp-1 mb-1">{p.name || p.displayId}</h3>
                  <p className="text-xs text-gray-500 mb-4">{p.description || 'No description'}</p>
                  
                  <div className="mt-auto pt-4 border-t border-gray-100 flex gap-2">
                    <button 
                      onClick={() => handleOpenWorkspace(p.id)}
                      className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-sm font-medium py-1.5 rounded transition-colors"
                    >
                      Open Editor
                    </button>
                    <button 
                      onClick={() => {
                        alert("Version branching logic would run here. It clones the project and increments the version number.");
                      }}
                      className="flex-1 bg-orange-50 hover:bg-orange-100 text-[#e13f00] border border-orange-200 text-sm font-medium py-1.5 rounded transition-colors"
                    >
                      New Version
                    </button>
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
