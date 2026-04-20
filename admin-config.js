'use strict';

const ADMIN_CONFIG = Object.freeze({
  API_BASE_URL: 'https://backend-mww.onrender.com',

  ENDPOINTS: Object.freeze({
    AUTH_LOGIN:       '/api/auth/login',
    AUTH_VERIFY:      '/api/auth/verify',
    AUTH_CHANGE_PASS: '/api/auth/change-password',
    OFFERS:           '/api/offers',
    OFFERS_ALL:       '/api/offers/all',
    OFFERS_STATS:     '/api/offers/stats',
    IMAGE_UPLOAD:     '/api/images/upload',
    IMAGE_UPLOAD_MULTI: '/api/images/upload-multiple',
    HEALTH:           '/api/health',
  }),
});
