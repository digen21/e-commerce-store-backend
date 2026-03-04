import Joi from "joi";

const id = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    "string.pattern.base": "Must be a valid ObjectId",
    "string.empty": "Id is required",
  });

export default id;
