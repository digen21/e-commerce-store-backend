import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

import { env } from "@config";
import { productService } from "@services";
import { catchAsync, getUploadImageSignature, ServerError } from "@utils";

class ProductController {
  createProduct = catchAsync(async (req: Request, res: Response) => {
    const productData = req.body;

    const product = await productService.create(productData);

    return res.status(httpStatus.CREATED).send({
      success: true,
      message: "Product created successfully",
      data: product,
      status: httpStatus.CREATED,
    });
  });

  getProducts = catchAsync(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = -1,
    } = req.query;

    const query: Record<string, unknown> = {};

    if (category) {
      query.category = { $regex: `^${category}$`, $options: "i" };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {} as { $gte?: number; $lte?: number };
      if (minPrice !== undefined)
        (query.price as { $gte?: number }).$gte = Number(minPrice);
      if (maxPrice !== undefined)
        (query.price as { $lte?: number }).$lte = Number(maxPrice);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const options = {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortBy as string]: Number(sortOrder) },
    };

    const result = await productService.paginate(query, options);

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Products retrieved successfully",
      data: result,
      status: httpStatus.OK,
    });
  });

  getProductById = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params as { id: string };

      const product = await productService.findById(id);

      if (!product) {
        return next(
          new ServerError({
            message: "Product not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Product retrieved successfully",
        data: product,
        status: httpStatus.OK,
      });
    },
  );

  updateProduct = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const updateData = req.body;

      const product = await productService.update({ _id: id }, updateData, {
        new: true,
        runValidators: true,
      });

      if (!product) {
        return next(
          new ServerError({
            message: "Product not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Product updated successfully",
        data: product,
        status: httpStatus.OK,
      });
    },
  );

  deleteProduct = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const product = await productService.update(
        { _id: id },
        {
          isDeleted: true,
          deletedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
        { new: true },
      );

      if (!product) {
        return next(
          new ServerError({
            message: "Product not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Product deleted successfully",
        status: httpStatus.OK,
      });
    },
  );

  getPresignedUrl = catchAsync(async (req: Request, res: Response) => {
    const { folder, public_id, resource_type = "image" } = req.body;

    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = getUploadImageSignature({
      timestamp,
      folder,
      public_id,
      resource_type,
    });

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Presigned URL generated successfully",
      data: {
        signature,
        timestamp,
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_KEY,
        public_id,
        folder,
        resource_type,
      },
      status: httpStatus.OK,
    });
  });
}

const productController = new ProductController();
export default productController;
