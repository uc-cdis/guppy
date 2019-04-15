const parseJWT = (req) => {
  const authHeader = req.headers.authorization || null;
  let jwt = null;
  if (authHeader != null) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) {
      if (parts[0].toLowerCase() === 'bearer') {
        jwt = parts[1]; // eslint-disable-line
      }
    }
  }
  return jwt;
};

export default {
  parseJWT,
};
