import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().required().min(2).max(50).messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 2 characters long',
    'string.max': 'First name cannot exceed 50 characters'
  }),
  lastName: Joi.string().required().min(2).max(50).messages({
    'string.empty': 'Last name is required',
    'string.min': 'Last name must be at least 2 characters long',
    'string.max': 'Last name cannot exceed 50 characters'
  }),
  phone: Joi.string().optional().allow('').pattern(/^\+?[\d\s-]{10,15}$/).messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  address: Joi.string().optional().allow('').trim(),
  bio: Joi.string().optional().allow('').trim()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required'
  }),
  newPassword: Joi.string().required().min(8).messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 8 characters long'
  })
});

