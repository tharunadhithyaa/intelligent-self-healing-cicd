import Joi from 'joi';

export const createDepartmentSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().required().min(5),
  contactInfo: Joi.string().required()
});

export const updateDepartmentSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().required().min(5),
  contactInfo: Joi.string().required(),
  status: Joi.string().required().valid('active', 'inactive')
});

export const assignOfficerSchema = Joi.object({
  officerId: Joi.string().required()
});

export const broadcastNotificationSchema = Joi.object({
  targetRoles: Joi.array().items(Joi.string()).default([]),
  title: Joi.string().required().min(5).max(100),
  message: Joi.string().required().min(10).max(500)
});
