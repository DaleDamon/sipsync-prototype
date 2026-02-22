const jwt = require('jsonwebtoken');

// Admin JWT validation middleware
const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.adminId) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }

    req.admin = {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      restaurantId: decoded.restaurantId
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Admin session expired. Please log in again.' });
    }
    return res.status(403).json({ error: 'Invalid admin token' });
  }
};

// Super admin only middleware (must be used after adminAuth)
const superAdminAuth = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

module.exports = { adminAuth, superAdminAuth };
