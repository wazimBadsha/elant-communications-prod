require("dotenv").config();
const AWS = require("aws-sdk");

// to generate md5 hash for file key
const md5 = require("md5");
const path = require("path");
const _ = require("lodash");

const apiResponse = require("../helpers/apiResponse");
// const auth = require("../middleware/jwtAuthMiddleware");

AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_SECRET_S3;
AWS.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_S3;

!_.isEmpty(process.env.AWS_REGION_S3) && (AWS.config.region = process.env.AWS_REGION_S3);

// const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
// const imageBuffer = Buffer.from(base64Data, 'base64');

// // Compress the image using sharp
// const compressedImageBuffer = await sharp(imageBuffer)
//     .resize(800, 800, { fit: sharp.fit.inside, withoutEnlargement: true }) // Adjust the size as needed
//     .jpeg({ quality: 80 }) // Adjust the quality as needed
//     .toBuffer();

// const imageFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;

// const uploadImageParams = {
//     Bucket: process.env.AWS_S3_BUCKET_NAME,
//     Key: imageFilename,
//     Body: compressedImageBuffer,
//     ContentType: 'image/jpeg',
// };

// try {
//     const imageS3Response = await s3.upload(uploadImageParams).promise();
//     imageLink = imageS3Response.Location;
//     console.log('Image uploaded successfully:', imageLink);
// } catch (err) {
//     console.error('Failed to upload image:', err);
//     throw err;
// }
exports.getSignedUrl = [
  // auth,
  async function (req, res) {
    try {
      // to get content type of file
      const mime = await import('mime');
      const { filePath = null } = req.body;

      // Uses node-mime to detect mime-type based on file extension
      const mimeType = mime.getType(filePath);

      // Time after which this signed url will expire
      const signedUrlExpireSeconds = process.env.S3_SIGNED_URL_EXPIRY
        ? parseInt(process.env.S3_SIGNED_URL_EXPIRY)
        : 10000;

      // create filename
      const md5Hash = md5(new Date().getTime());

      const fileExtension = path.extname(filePath);

      let fileKey = `${md5Hash}${fileExtension}`;

      let uploadFolder = process.env.AWS_FOLDER_S3;

      const s3 = new AWS.S3();

      const myBucket = process.env.AWS_S3_BUCKET_NAME;
      const s3ObjectKey = `${uploadFolder}/${fileKey}`;

      const params = {
        Bucket: myBucket,
        Key: s3ObjectKey,
        Expires: signedUrlExpireSeconds,
        ContentType: mimeType,
      };

      s3.getSignedUrl("putObject", params, function (err, url) {
        if (err) {
          console.log("[FileUploadController-getSignedUrl]-Error getting presigned url from AWS S3", err);
          return apiResponse.ErrorResponse(res, err);
        } else {
          apiResponse.successResponseWithData(res, "Signed URL", {
            status: "success",
            data: {
              signedUrl: url,
              s3ObjectKey,
              downloadUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION_S3}.amazonaws.com/${s3ObjectKey}`,
              mimeType,
            },
          });
        }
      });
    } catch (err) {
      console.log("[FileUploadController-getSignedUrl]-Error", err);
      //throw error in json response with status 500.
      return apiResponse.ErrorResponse(res, err);
    }
  },
];
