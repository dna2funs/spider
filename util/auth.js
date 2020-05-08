const i_env = require('../env');

const api = {
   staticBasic: async (req) => {
      if (!i_env.server.staticBasicAuth) return true;
      const auth = req.headers['authorization'];
      if (!auth) return false;
      const method = auth.split(/\s+/)[0];
      if (method !== 'Basic') return false;
      const staticKey = auth.substring(method.length).trim();
      if (staticKey === i_env.server.staticBasicAuth) return true;
      return false;
   },
};

module.exports = api;