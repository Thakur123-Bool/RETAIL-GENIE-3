// src/utils/index.js
export const createPageUrl = (pageName) => {
  const map = {
    Dashboard: '/',
    NewPrediction: '/newprediction',
    JobMonitor: '/jobmonitor',
    Reports: '/reports',
  };
  return map[pageName] || `/${pageName.toLowerCase()}`;
};