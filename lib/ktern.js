export const KTERN_API = {
  login: '/api/auth/login',
  projects: '/api/projects',
  projectEntities: (pid) => `/api/projects/${pid}/entities`,
  entity: (pid, id) => `/api/projects/${pid}/entities/${id}`,
  entityChildren: (pid, id) => `/api/projects/${pid}/entities/${id}/children`,
  entityParent: (pid, id) => `/api/projects/${pid}/entities/${id}/parent`,
  entityComments: (pid, id) => `/api/projects/${pid}/entities/${id}/comments`,
  attachments: '/api/attachments',
};
