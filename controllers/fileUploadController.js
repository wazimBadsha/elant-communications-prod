const AWS = require("aws-sdk");
const mime = require("mime-types");
const md5 = require("md5");
const path = require("path");
const apiResponse = require("../helpers/apiResponse");

// Configure AWS region and signature version
AWS.config.update({
  region: process.env.AWS_REGION_S3,
  signatureVersion: 'v4',
});

const s3 = new AWS.S3();

exports.getSignedUrl = async function (req, res) {
  try {
    const { filePath = null } = req.body;
    if (!filePath) {
      return apiResponse.ErrorResponse(res, "File path is required.");
    }

    // Detect mime-type based on file extension
    const mimeType = mime.contentType(filePath);

    // Use the expiry time from environment variables or default to 10000 seconds
    const signedUrlExpireSeconds = process.env.S3_SIGNED_URL_EXPIRY 
      ? parseInt(process.env.S3_SIGNED_URL_EXPIRY) 
      : 10000;

    // Create a unique file key using md5 hash
    const md5Hash = md5(new Date().getTime());
    const fileExtension = path.extname(filePath);
    const fileKey = `${md5Hash}${fileExtension}`;
    const uploadFolder = process.env.AWS_FOLDER_S3;
    const s3ObjectKey = `${uploadFolder}/${fileKey}`;

    // Parameters for the signed URL
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3ObjectKey,
      Expires: signedUrlExpireSeconds,
      ContentType: mimeType,
    };

    // Generate the signed URL
    const signedUrl = await s3.getSignedUrlPromise("putObject", params);

    apiResponse.successResponseWithData(res, "Signed URL", {
      status: "success",
      data: {
        signedUrl,
        s3ObjectKey,
        downloadUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION_S3}.amazonaws.com/${s3ObjectKey}`,
        mimeType,
      },
    });
  } catch (err) {
    console.error("[FileUploadController-getSignedUrl]-Error", err);
    return apiResponse.ErrorResponse(res, err);
  }
};