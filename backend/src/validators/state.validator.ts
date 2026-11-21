import { celebrate, Joi, Segments } from 'celebrate';

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

export const slaQueryValidator = celebrate({
  [Segments.QUERY]: Joi.object().keys({
    hours: Joi.number().integer().min(0).max(720).default(48).messages({
      'number.base': 'SLA threshold hours must be an integer.',
      'number.min': 'SLA threshold hours must be at least 0.',
      'number.max': 'SLA threshold hours cannot exceed 720 hours (30 days).'
    }),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
});
