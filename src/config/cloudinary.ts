import cloudinary from "cloudinary";

import env from "./envVariable";

const cld = cloudinary.v2;

cld.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_KEY,
  api_secret: env.CLOUDINARY_SECRET,
});

export default cld;
