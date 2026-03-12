const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, admin } = require('../middleware/auth');

// Import controllers (we'll create these next)
const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  updateProfile,
  changePassword
} = require('../controllers/userController');

// All routes below this line require authentication
router.use(protect);

// User profile routes
router.get('/profile', getUserById);
router.put('/profile', updateProfile);
router.put('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], changePassword);

// User stats
router.get('/stats', getUserStats);

// Admin only routes
router.get('/', admin, getUsers);
router.get('/:id', admin, getUserById);
router.put('/:id', admin, updateUser);
router.delete('/:id', admin, deleteUser);

module.exports = router;