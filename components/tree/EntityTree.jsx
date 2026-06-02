'use client';

import { useState, useEffect } from 'react';
import StatusBadge from '../shared/StatusBadge';

export default function EntityTree({ projectId, onSelectEntity, selectedEntityId }) {
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const rawRole = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ktern_role') : null;
  const role = rawRole ? rawRole.toLowerCase() : null;
  const canEditTree = role === 'admin' || role === 'sme';

  useEffect(() => {
    if (!projectId) return;

    const fetchRoots = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/entities/hierarchy/roots`);
        if (!res.ok) throw new Error('Failed to fetch roots');
        const data = await res.json();
        const entities = Array.isArray(data) ? data : (data.items || data.entities || []);
        setRoots(entities);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoots();
    
    const handleNodeDeleted = (e) => {
      setRoots(prev => prev.filter(c => c.id !== e.detail));
    };
    window.addEventListener('ktern-entity-deleted', handleNodeDeleted);
    return () => window.removeEventListener('ktern-entity-deleted', handleNodeDeleted);
  }, [projectId]);

  const handleAddRoot = async () => {
    const name = prompt('Enter root entity name (e.g. Wave 1):');
    if (!name) return;
    
    try {
      // 1. Fetch valid entity types for this project
      const typesRes = await fetch(`/api/projects/${projectId}/entity-types`);
      const types = await typesRes.json();
      const type = types[0];
      const validTypeId = type?.id || type?.typeId;
      
      if (!validTypeId) {
        alert('No entity types defined for this project!');
        return;
      }

      // Find the attribute ID for "content" (or fallback to first textarea)
      const contentAttr = type.attributes?.find(a => a.name === 'content' || a.name === 'name') || type.attributes?.[0];
      const attrKey = contentAttr ? contentAttr.id : 'content';

      const res = await fetch(`/api/projects/${projectId}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeId: validTypeId, values: { [attrKey]: name } })
      });
      if (res.ok) {
        const newNode = await res.json();
        setRoots([...roots, newNode]);
        alert('Root entity created via POST!');
      } else {
        const errData = await res.json();
        alert('Failed: ' + (errData.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading tree...</div>;
  if (!roots.length) return (
    <div className="p-4 text-sm text-gray-500 text-center mt-4">
      No content found.<br/>
      {canEditTree && (
        <button onClick={handleAddRoot} className="text-[#e13f00] hover:underline mt-2">+ Create Root Node</button>
      )}
    </div>
  );

  return (
    <div className="p-2">
      {roots.map(root => (
        <TreeNode 
          key={root.id} 
          node={root} 
          projectId={projectId} 
          onSelectEntity={onSelectEntity}
          selectedEntityId={selectedEntityId}
          canEditTree={canEditTree}
        />
      ))}
      {canEditTree && (
        <button onClick={handleAddRoot} className="text-xs text-gray-500 hover:text-[#e13f00] mt-4 ml-2">+ Add Root</button>
      )}
    </div>
  );
}

function TreeNode({ node, projectId, onSelectEntity, selectedEntityId, canEditTree }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const isSelected = selectedEntityId === node.id;

  const handleExpand = async (e) => {
    e.stopPropagation();
    
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    if (children.length === 0) {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/entities/${node.id}/children`);
        if (res.ok) {
          const data = await res.json();
          setChildren(Array.isArray(data) ? data : data.entities || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddChild = async (e) => {
    e.stopPropagation();
    const name = prompt(`Enter child name under ${node.values?.content || node.displayId}:`);
    if (!name) return;

    try {
      // 1. Fetch valid entity types for this project
      const typesRes = await fetch(`/api/projects/${projectId}/entity-types`);
      const types = await typesRes.json();
      // Find the entity type of the CURRENT node
      const currentType = types.find(t => t.id === node.typeId || t.name === (node.entityType?.name || node.type?.name));
      
      let validTypeId = null;
      let type = null;
      
      // Try to find the next type based on hierarchyLevel
      if (currentType && typeof currentType.hierarchyLevel === 'number') {
        const nextTypes = types.filter(t => typeof t.hierarchyLevel === 'number' && t.hierarchyLevel > currentType.hierarchyLevel);
        if (nextTypes.length > 0) {
           nextTypes.sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);
           type = nextTypes[0];
           validTypeId = type.id;
        }
      }
      
      // Fallback: If no hierarchyLevel is configured, guess the next one in the array
      if (!type) {
        const currentIndex = types.findIndex(t => t.id === node.typeId || t.name === (node.entityType?.name || node.type?.name));
        type = types[currentIndex + 1] || types[types.length - 1] || types[0];
        validTypeId = type?.id || type?.typeId;
      }

      if (!validTypeId) throw new Error('No entity types found');

      // Find the attribute ID for "content"
      const contentAttr = type.attributes?.find(a => a.name === 'content' || a.name === 'name') || type.attributes?.[0];
      const attrKey = contentAttr ? contentAttr.id : 'content';

      // 2. Create the entity
      const res = await fetch(`/api/projects/${projectId}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeId: validTypeId, values: { [attrKey]: name } })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Create failed');
      }
      const newChild = await res.json();

      // 2. Set the parent. Try PATCH first, then PUT as a fallback.
      // Both require hasHierarchy=true on the entity type — this is set during cloning.
      let parentRes = await fetch(`/api/projects/${projectId}/entities/${newChild.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: node.id })
      });

      if (!parentRes.ok) {
        const patchErr = await parentRes.text();
        console.warn(`[AddChild] PATCH parent failed (${parentRes.status}), trying PUT:`, patchErr);
        parentRes = await fetch(`/api/projects/${projectId}/entities/${newChild.id}/parent`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: node.id })
        });
      }

      if (!parentRes.ok) {
        const parentErr = await parentRes.text();
        console.error('[AddChild] Set parent failed:', parentErr);
        // Rollback — delete the orphaned entity
        await fetch(`/api/projects/${projectId}/entities/${newChild.id}`, { method: 'DELETE' });
        throw new Error(
          `Cannot add child: the entity type "${type?.name}" may not have hierarchy enabled. ` +
          `Try using a freshly cloned project. (${parentRes.status})`
        );
      }

      setChildren([...children, newChild]);
      setExpanded(true);
    } catch (err) {
      console.error(err);
      alert('Failed to add child: ' + err.message);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${node.values?.content || node.displayId}?`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/entities/${node.id}`, { method: 'DELETE' });
      if (res.ok) {
        // Inform parent to remove this node from state
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ktern-entity-deleted', { detail: node.id }));
        }
      } else {
        alert('Failed to delete entity');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Listen for delete events to update children state
  useEffect(() => {
    const handleNodeDeleted = (e) => {
      setChildren(prev => prev.filter(c => c.id !== e.detail));
    };
    window.addEventListener('ktern-entity-deleted', handleNodeDeleted);
    return () => window.removeEventListener('ktern-entity-deleted', handleNodeDeleted);
  }, []);

  return (
    <div className="pl-4">
      <div 
        className={`group flex items-center gap-2 p-2 rounded cursor-pointer text-sm hover:bg-gray-100 ${isSelected ? 'bg-orange-50 border-l-2 border-[#e13f00]' : 'border-l-2 border-transparent'}`}
        onClick={() => onSelectEntity(node)}
      >
        <div onClick={handleExpand} className="w-4 h-4 flex items-center justify-center text-gray-400">
          {loading ? '...' : (expanded ? '▼' : '▶')}
        </div>
        <span 
          className={`flex-1 text-sm select-none ${node.id === selectedEntityId ? 'font-bold text-[#0F172A]' : 'font-medium text-gray-700'}`}
        >
          {node.values?.content || node.displayId} 
          {node.values?.assigned_reviewer && (
            <span className="ml-2 text-[10px] font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              @ {node.values.assigned_reviewer}
            </span>
          )}
        </span>
        {node.status && <StatusBadge status={node.status} />}
        
        {/* Add Child Button */}
        {canEditTree && (
          <button 
            onClick={handleAddChild}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#e13f00] px-1 text-xs transition-opacity"
            title="Add Child Entity"
          >
            +
          </button>
        )}
        
        {/* Delete Node Button */}
        {canEditTree && (
          <button 
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 px-1 text-xs transition-opacity"
            title="Delete Entity"
          >
            🗑
          </button>
        )}
      </div>
      
      {expanded && (
        <div className="border-l border-gray-200 ml-2 mt-1">
          {children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              projectId={projectId} 
              onSelectEntity={onSelectEntity}
              selectedEntityId={selectedEntityId}
              canEditTree={canEditTree}
            />
          ))}
        </div>
      )}
    </div>
  );
}
