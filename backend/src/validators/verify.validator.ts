import { celebrate, Joi, Segments } from 'celebrate';

export const verifyCodeParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    code: Joi.string()
      .trim()
      .uppercase()
      .regex(/^PSM-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid verification code format. Expected format: PSM-XXXX-XXXX (e.g. PSM-62D1-324F)',
        'any.required': 'Verification code is required.'
      })
  })
});
