import { celebrate, Joi, Segments } from 'celebrate';
import { CertificateStatus } from '@prisma/client';

export const listCertificatesQueryValidator = celebrate({
  [Segments.QUERY]: Joi.object().keys({
    status: Joi.string()
      .valid(CertificateStatus.ISSUED, CertificateStatus.CANCELLED)
      .optional()
      .messages({
        'any.only': 'Status filter must be either ISSUED or CANCELLED.'
      }),
    batchId: Joi.string().uuid().optional().messages({
      'string.guid': 'batchId must be a valid UUID.'
    }),
    search: Joi.string().trim().max(100).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
});

export const certificateIdParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid Certificate ID format (must be a valid UUID).'
    })
  })
});
