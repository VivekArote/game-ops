const Joi = require('joi');
const logger = require('./logger');

const scoreSchema = Joi.object({
  player_id: Joi.string().trim().required().messages({
    'any.required': 'player_id is required',
    'string.empty': 'player_id cannot be empty',
  }),
  match_id: Joi.string().trim().required().messages({
    'any.required': 'match_id is required',
    'string.empty': 'match_id cannot be empty',
  }),
  region: Joi.string().trim().required().messages({
    'any.required': 'region is required',
    'string.empty': 'region cannot be empty',
  }),
  device: Joi.string().trim().required().messages({
    'any.required': 'device is required',
    'string.empty': 'device cannot be empty',
  }),
  ping: Joi.number().integer().min(0).required().messages({
    'any.required': 'ping is required',
    'number.base': 'ping must be a number',
    'number.min': 'ping cannot be negative',
  }),
  score: Joi.number().integer().min(0).required().messages({
    'any.required': 'score is required',
    'number.base': 'score must be a number',
    'number.min': 'score cannot be negative',
  }),
  kills: Joi.number().integer().min(0).required().messages({
    'any.required': 'kills is required',
    'number.base': 'kills must be a number',
    'number.min': 'kills cannot be negative',
  }),
  deaths: Joi.number().integer().min(0).required().messages({
    'any.required': 'deaths is required',
    'number.base': 'deaths must be a number',
    'number.min': 'deaths cannot be negative',
  }),
  match_duration_seconds: Joi.number().integer().positive().required().messages({
    'any.required': 'match_duration_seconds is required',
    'number.base': 'match_duration_seconds must be a number',
    'number.positive': 'match_duration_seconds must be greater than 0',
  }),
});

const validateScore = (req, res, next) => {
  const { error, value } = scoreSchema.validate(req.body, { abortEarly: false, stripUnknown: true });

  if (error) {
    const errorDetails = error.details.map((d) => d.message);
    logger.warn(`Validation failed for POST /api/scores: ${JSON.stringify(errorDetails)}`);
    return res.status(400).json({
      status: 'fail',
      message: 'Validation error',
      errors: errorDetails,
    });
  }

  // Replace req.body with clean, validated value
  req.body = value;
  next();
};

module.exports = {
  validateScore,
};
