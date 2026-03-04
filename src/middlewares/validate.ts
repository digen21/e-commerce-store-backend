import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import Joi, { ObjectSchema } from "joi";

const formatErrors = (details: Joi.ValidationErrorItem[]) =>
  details.map((d) => ({
    field: d.path.slice(1).join("."),
    message: d.message.replace(/"/g, ""),
  }));

const validate = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(
      { body: req.body, params: req.params, query: req.query },
      { abortEarly: false, stripUnknown: true },
    );

    if (error) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: formatErrors(error.details),
      });
    }

    if (value.body) Object.assign(req.body, value.body);
    if (value.params) Object.assign(req.params, value.params);
    if (value.query) Object.assign(req.query, value.query);
    next();
  };
};

export default validate;
