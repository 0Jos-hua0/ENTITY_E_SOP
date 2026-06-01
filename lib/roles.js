export const ROLES = {
  ADMIN: 'Admin',
  SME: 'SME',
  REVIEWER: 'Reviewer',
  CONSUMER: 'Consumer'
};

export const getDashboardRoute = (role) => {
  switch (role) {
    case ROLES.ADMIN: return '/admin';
    case ROLES.SME: return '/sme';
    case ROLES.REVIEWER: return '/reviewer';
    case ROLES.CONSUMER: return '/consumer';
    default: return '/login';
  }
};
