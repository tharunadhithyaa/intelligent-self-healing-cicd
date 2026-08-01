import Joi from "joi";
import { COMPLAINT_STATUSES } from "../../models/complaint.model";

export const transitionStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...COMPLAINT_STATUSES)
    .required(),
  title: Joi.string().optional().allow(""),
  description: Joi.string().optional().allow(""),
});

export const assignWorkerSchema = Joi.object({
  workerId: Joi.string().required(),
  notes: Joi.string().optional().allow(""),
});

export const addNoteSchema = Joi.object({
  text: Joi.string().required().min(1).max(2000),
});

export const submitResolutionSchema = Joi.object({
  description: Joi.string().required().min(10).max(5000),
  details: Joi.string().optional().allow(""),
});
