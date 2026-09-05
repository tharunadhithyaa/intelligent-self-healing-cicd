import Joi from "joi";

const complaintImageValidation = Joi.object({
  base64Data: Joi.string().required(),
  contentType: Joi.string().required(),
  fileName: Joi.string().required(),
});

export const updateJobStatusSchema = Joi.object({
  status: Joi.string().valid("in_progress", "waiting", "resolved").required(),
  notes: Joi.string().optional().allow(""),
});

export const uploadPhotosSchema = Joi.object({
  photoType: Joi.string().valid("before", "after").required(),
  images: Joi.array().items(complaintImageValidation).min(1).max(3).required(),
});
