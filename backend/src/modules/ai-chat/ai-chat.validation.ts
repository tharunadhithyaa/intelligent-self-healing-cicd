import Joi from 'joi';

export const sendMessageSchema = Joi.object({
  conversationId: Joi.string().optional().allow(''),
  message: Joi.string().required().min(1).max(1000)
});
