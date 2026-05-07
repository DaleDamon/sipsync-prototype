const jwt = require('jsonwebtoken');

const userAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Ensure the token owner matches the userId being written to
    const bodyUserId = req.body.userId;
    if (bodyUserId && decoded.userId !== bodyUserId) {
      return res.status(403).json({ error: 'Token does not match user' });
    }

    req.user = { userId: decoded.userId, phoneNumber: decoded.phoneNumber };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { userAuth };
