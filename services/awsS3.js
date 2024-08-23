const AWS = require('aws-sdk');

AWS.config.update({
    accessKeyId: process.env.AWS_SECRET_S3,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_S3
});

const s3 = new AWS.S3({
    params: {
        Bucket: process.env.AWS_S3_BUCKET_NAME
    }
});

module.exports = s3;