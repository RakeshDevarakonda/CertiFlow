import { celebrate, Joi, Segments } from 'celebrate';

export const signupValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    name: Joi.string().trim().min(2).max(100).required().messages({
      'string.empty': 'Name is required.',
      'string.min': 'Name must be at least 2 characters long.'
    }),
    email: Joi.string().trim().email().required().messages({
      'string.empty': 'Email is required.',
      'string.email': 'Please provide a valid email address.'
    }),
    password: Joi.string().min(6).max(128).required().messages({
      'string.empty': 'Password is required.',
      'string.min': 'Password must be at least 6 characters long.'
    }),
    centreName: Joi.string().trim().min(3).max(150).required().messages({
      'string.empty': 'Training centre name is required.'
    }),
    centreCode: Joi.string().trim().uppercase().min(3).max(30).required().messages({
      'string.empty': 'Training centre code is required.'
    }),
    state: Joi.string().trim().min(2).max(50).required().messages({
      'string.empty': 'State is required.'
    }),
    district: Joi.string().trim().min(2).max(50).required().messages({
      'string.empty': 'District is required.'
    })
  })
});

export const loginValidator = celebrate({
  [Segments.BODY]: Joi.object().keys({
    email: Joi.string().trim().email().required().messages({
      'string.empty': 'Email is required.',
      'string.email': 'Please provide a valid email address.'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required.'
    })
  })
});
