import { celebrate, Joi, Segments } from 'celebrate';

export const batchIdParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.empty': 'Batch ID is required.',
      'string.guid': 'Invalid Batch ID format (must be a valid UUID).'
    })
  })
});

export const paginationQueryValidator = celebrate({
  [Segments.QUERY]: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
});

export const createAndSubmitBatchValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    courseName: Joi.string().trim().min(3).max(150).required().messages({
      'string.empty': 'Course name is required.',
      'string.min': 'Course name must be at least 3 characters long.',
      'any.required': 'Course name is required.'
    })
  })
});

export const resubmitBatchValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Batch ID format (must be a valid UUID).'
    })
  }),
  [Segments.BODY]: Joi.object().keys({
    courseName: Joi.string().trim().min(3).max(150).optional().messages({
      'string.min': 'Course name must be at least 3 characters long.'
    })
  })
});
