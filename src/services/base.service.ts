import {
  PaginateModel,
  PaginateOptions,
  PaginateResult,
  ProjectionType,
  QueryFilter,
  QueryOptions,
  Types,
  UpdateQuery,
} from "mongoose";

import {
  AdminProfile,
  Analytics,
  Order,
  Payment,
  Product,
  Token,
  User,
  UserDetails,
} from "@models";
import {
  IAdminProfile,
  IAnalytics,
  IOrder,
  IPayment,
  IProduct,
  IToken,
  IUser,
  IUserDetails,
} from "@types";

type Where<T> = Partial<Record<keyof T, unknown>>;

export class BaseRepository<T> {
  constructor(protected model: PaginateModel<T>) {}

  paginate(
    where: Where<T>,
    options?: PaginateOptions,
  ): Promise<PaginateResult<T>> {
    return this.model.paginate(where, options);
  }

  find(
    where: Where<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ) {
    return this.model.find(where, projection, options);
  }

  findOne(
    where: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ) {
    return this.model.findOne(where, projection, options);
  }

  create(data: Partial<T>) {
    const doc = new this.model(data);
    return doc.save();
  }

  update(
    query: QueryFilter<T>,
    data: UpdateQuery<T>,
    options?: QueryOptions<T> | null,
  ) {
    return this.model.findOneAndUpdate(query, data, {
      ...options,
      runValidators: true,
      context: "query",
      new: true,
    });
  }

  delete(query: Where<T>) {
    return this.model.findOneAndUpdate(query, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }

  count(query: Where<T>) {
    return this.model.countDocuments(query);
  }

  findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ) {
    return this.model.findById(id, projection, options);
  }
}

export const userService = new BaseRepository<IUser>(User);
export const tokenService = new BaseRepository<IToken>(Token);
export const userDetailService = new BaseRepository<IUserDetails>(UserDetails);
export const orderService = new BaseRepository<IOrder>(Order);
export const productService = new BaseRepository<IProduct>(Product);
export const analyticsService = new BaseRepository<IAnalytics>(Analytics);
export const paymentService = new BaseRepository<IPayment>(Payment);
export const adminProfileService = new BaseRepository<IAdminProfile>(
  AdminProfile,
);
