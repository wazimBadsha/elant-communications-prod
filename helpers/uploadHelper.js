import axios from "axios";
import { axiosInstance } from "./axiosConfig";

export const generateSignedUrl = async (file) => {
    try {
        const params = { filePath: file.name };
        const response = await axiosInstance.post(`/api/helper/generate-signed-url`, params);
        console.log("RESPONSE====",JSON.stringify(response.data.data))
        if (response.data  && response.data.data && response.data.data.status && response.data.data.status === "success") {
            return response.data.data;
        } else {
            throw response;
        }
    } catch (error) {
        console.error('Error helpers/uploadHelper.js-generateSignedUrl:', error);
        throw error;
    }
};


export const uploadFileToSignedUrl = (data, file) => {
    const mimeType = data.mimeType;
    const signedUrl = data.signedUrl;
    const headers = {
        "Content-Type": mimeType,
    };
    return axios
        .put(signedUrl, file, { headers })
        .then((response) => {
            return response;
        })
        .catch((err) => console.log("Error helpers/uploadHelper.js-uploadFileToSignedUrl", err));
};


// ui usage sample : 
// const response = await generateSignedUrl(whiteLogoFileToUpload);
// console.log("RESPONSE2===", JSON.stringify(response.data.downloadUrl));
// if (response && response.data && response.data.signedUrl && response.data.signedUrl != null) {
//   // Upload file into signed URL.
//   const uploadRes = await uploadFileToSignedUrl(response.data, whiteLogoFileToUpload);
//   if (uploadRes) {
//     companyDetails.white_logo = response.data.downloadUrl; // Fixed typo: changed `while_logo` to `white_logo`
//   }
// }
