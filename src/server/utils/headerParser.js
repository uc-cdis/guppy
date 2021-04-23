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

// TODO change 'Siganture: signature token' to 'Authorizzation: Signature token' instead of Bearer after testing
const parseSignature = (req) => {
  const authHeader = req.headers.signature || null;
  let signature = null;
  if (authHeader != null) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) {
      if (parts[0].toLowerCase() === 'signature') {
        signature = parts[1]; 
      }
    }
  }
  return signature;
};


export default {
  parseJWT,
  parseSignature,
};
