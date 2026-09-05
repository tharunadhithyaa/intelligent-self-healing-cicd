import Joi from "joi";
import { COMPLAINT_CATEGORIES } from "../../models/complaint.model";

export const submitComplaintSchema = Joi.object({
  title: Joi.string().required().min(5).max(100).messages({
    "string.empty": "Title is required",
    "string.min": "Title must be at least 5 characters long",
    "string.max": "Title cannot exceed 100 characters",
  }),
  description: Joi.string().required().min(10).messages({
    "string.empty": "Description is required",
    "string.min": "Description must be at least 10 characters long",
  }),
  category: Joi.string()
    .required()
    .valid(...COMPLAINT_CATEGORIES)
    .messages({
      "any.only": "Please select a valid complaint category",
    }),
  location: Joi.object({
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180),
    address: Joi.string().required().trim(),
  }).required(),
  images: Joi.array()
    .items(
      Joi.object({
        base64Data: Joi.string().required(),
        contentType: Joi.string().required(),
        fileName: Joi.string().required(),
      }),
    )
    .default([]),
});

export const analyzeDraftSchema = Joi.object({
  title: Joi.string().required().allow(""),
  description: Joi.string().required().allow(""),
  location: Joi.object({
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180),
    address: Joi.string().required().trim().allow(""),
  }).required(),
});
