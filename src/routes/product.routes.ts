import express from "express";

import { productController } from "@controllers";
import { isAdminRole, isAuth, rateLimiter, validate } from "@middlewares";
import {
  createProductValidatorSchema,
  deleteProductValidatorSchema,
  getPresignedUrlValidatorSchema,
  getProductValidatorSchema,
  updateProductValidatorSchema,
} from "@validators";

const productRouter = express.Router();

// Public routes - readable by anyone
productRouter.get("/", rateLimiter, productController.getProducts);

// Admin-only route - Get low stock products (must be before /:id to avoid matching)
productRouter.get(
  "/low-stock",
  isAuth,
  isAdminRole,
  productController.getLowStockProducts,
);

productRouter.get(
  "/:id",
  rateLimiter,
  validate(getProductValidatorSchema),
  productController.getProductById,
);

// Admin-only routes - write operations
productRouter.post(
  "/",
  isAuth,
  isAdminRole,
  validate(createProductValidatorSchema),
  productController.createProduct,
);

productRouter.put(
  "/:id",
  isAuth,
  isAdminRole,
  validate(updateProductValidatorSchema),
  productController.updateProduct,
);

productRouter.delete(
  "/:id",
  isAuth,
  isAdminRole,
  validate(deleteProductValidatorSchema),
  productController.deleteProduct,
);

// Presigned URL for image upload (authenticated users)
productRouter.post(
  "/upload/signature",
  isAuth,
  rateLimiter,
  validate(getPresignedUrlValidatorSchema),
  productController.getPresignedUrl,
);

export default productRouter;
