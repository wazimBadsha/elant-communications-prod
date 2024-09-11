require("dotenv").config();
const AWS = require("aws-sdk");
const md5 = require("md5");
const path = require("path");
var mime = require('mime-types');
const apiResponse = require("../helpers/apiResponse");

AWS.config = new AWS.Config({
  accessKeyId: process.env.AWS_SECRET_S3,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_S3,
  region: process.env.AWS_REGION_S3,
  signatureVersion: 'v4'
});

const s3 = new AWS.S3();

exports.getSignedUrl = async function (req, res) {
  try {
    const { filePath = null } = req.body;
    const mimeType = mime.contentType(filePath);
    const signedUrlExpireSeconds = process.env.S3_SIGNED_URL_EXPIRY
      ? parseInt(process.env.S3_SIGNED_URL_EXPIRY)
      : 10000;

    const md5Hash = md5(new Date().getTime());
    const fileExtension = path.extname(filePath);
    let fileKey = `${md5Hash}${fileExtension}`;
    let uploadFolder = process.env.AWS_FOLDER_S3;
    const myBucket = process.env.AWS_S3_BUCKET_NAME;
    const s3ObjectKey = `${uploadFolder}/${fileKey}`;

    const params = {
      Bucket: myBucket,
      Key: s3ObjectKey,
      Expires: signedUrlExpireSeconds,
      ContentType: mimeType,
      ACL: 'public-read'  // <-- Add this to make the file publicly readable
    };

    const signedUrl = await s3.getSignedUrlPromise('putObject', params);
    
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