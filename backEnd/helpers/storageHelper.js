require("dotenv").config();

const { Storage } = require("@google-cloud/storage");
const { v4: uuidv4 } = require("uuid");

const uploadImage = async (imageBuffer) => {
  const bucketName = process.env.BUCKET_NAME;
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const fileName = `${uuidv4()}.jpg`; // Use UUID for unique file names
  const file = bucket.file(fileName);

  await file.save(imageBuffer, {
    metadata: {
      contentType: "image/jpeg",
    },
  });
  
  await file.makePublic();
  return fileName;
};

module.exports = { uploadImage };
