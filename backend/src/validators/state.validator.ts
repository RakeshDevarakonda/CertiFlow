import { celebrate, Joi, Segments } from 'celebrate';
import { ApprovalAction } from '@prisma/client';

export const batchIdParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Batch ID format (must be a valid UUID).'
    })
  })
});

export const certificateIdParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Certificate ID format (must be a valid UUID).'
    })
  })
});

export const stateReasonValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Batch ID format (must be a valid UUID).'
    })
  }),
  [Segments.BODY]: Joi.object().keys({
    comment: Joi.string().trim().min(5).max(500).required().messages({
      'string.empty': 'A reason/comment is required.',
      'string.min': 'Reason must be at least 5 characters long.',
      'any.required': 'A reason/comment is required.'
    })
  })
});

export const cancelCertificateValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Certificate ID format (must be a valid UUID).'
    })
  }),
  [Segments.BODY]: Joi.object().keys({
    reason: Joi.string().trim().min(5).max(500).required().messages({
      'string.empty': 'A cancellation reason is required.',
      'string.min': 'Cancellation reason must be at least 5 characters long.',
      'any.required': 'A cancellation reason is required.'
    })
  })
});

export const stateDecisionValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Batch ID format (must be a valid UUID).'
    })
  }),
  [Segments.BODY]: Joi.object().keys({
    action: Joi.string()
      .valid(ApprovalAction.APPROVED, ApprovalAction.RETURNED, ApprovalAction.REJECTED)
      .required()
      .messages({
        'any.only': 'Action must be one of: APPROVED, RETURNED, REJECTED.',
        'any.required': 'Decision action is required.'
      }),
    comment: Joi.string().trim().max(500).when('action', {
      is: Joi.valid(ApprovalAction.RETURNED, ApprovalAction.REJECTED),
      then: Joi.string().required().min(5).messages({
        'string.empty': 'A reason/comment is required when returning or rejecting a batch.',
        'string.min': 'Reason must be at least 5 characters long.',
        'any.required': 'A reason/comment is required when returning or rejecting a batch.'
      }),
      otherwise: Joi.optional().allow('', null)
    })
  })
});
