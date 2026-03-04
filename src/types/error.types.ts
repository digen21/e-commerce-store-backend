import { ServerError } from "@utils";
import { MongooseError } from "mongoose";

export type ErrorType = Error | ServerError | MongooseError;
