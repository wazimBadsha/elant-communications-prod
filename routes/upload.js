const express = require("express");
const FileUploadController = require("../controllers/fileUploadController.js");

const router = express.Router();

router.post("/generate-signed-url", FileUploadController.getSignedUrl);

module.exports = router;
