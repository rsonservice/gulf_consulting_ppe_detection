const express = require("express");
const cors = require("cors");
const multer = require("multer");
const {
  RekognitionClient,
  DetectProtectiveEquipmentCommand,
} = require("@aws-sdk/client-rekognition");
const fs = require("fs");
const sharp = require("sharp");
const { createCanvas, loadImage } = require("canvas");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const port = process.env.PORT || 8000; // Or any other desired port
const serverUrl = process.env.SERVER_URL || `https://detection.gulfconsulting.com.au`;

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Create processed images directory if it doesn't exist
const processedImagesDir = path.join(__dirname, "processed-images");
if (!fs.existsSync(processedImagesDir)) {
  fs.mkdirSync(processedImagesDir, { recursive: true });
}

// Enable CORS for all routes
app.use(
  cors({
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);
app.use(express.json());

// Serve static files for processed images
app.use("/processed-images", express.static(processedImagesDir));

require("dotenv").config();

// AWS config
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION,
});

// Function to clean up generated files
function cleanupFiles(filePaths) {
  filePaths.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  });
}

// Function to clean up all files in processed-images directory
function cleanupProcessedImages() {
  try {
    if (fs.existsSync(processedImagesDir)) {
      const files = fs.readdirSync(processedImagesDir);
      files.forEach((file) => {
        const filePath = path.join(processedImagesDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up processed image: ${filePath}`);
        } catch (error) {
          console.error(
            `Error cleaning up processed image ${filePath}:`,
            error
          );
        }
      });
    }
  } catch (error) {
    console.error("Error cleaning up processed images directory:", error);
  }
}

// Function to draw equipment bounding boxes on full image, then crop person region
async function processPersonImage(
  originalImagePath,
  person,
  imageMetadata,
  generatedFiles,
  confidenceThreshold = 80
) {
  try {
    const { width: imgWidth, height: imgHeight } = imageMetadata;

    // Calculate crop coordinates for the person
    const cropX = Math.floor(person.BoundingBox.Left * imgWidth);
    const cropY = Math.floor(person.BoundingBox.Top * imgHeight);
    const cropWidth = Math.floor(person.BoundingBox.Width * imgWidth);
    const cropHeight = Math.floor(person.BoundingBox.Height * imgHeight);

    // Create canvas with full image size first
    const fullCanvas = createCanvas(imgWidth, imgHeight);
    const fullCtx = fullCanvas.getContext("2d");

    // Load the original full image onto canvas
    const originalImg = await loadImage(originalImagePath);
    fullCtx.drawImage(originalImg, 0, 0);

    // Draw equipment bounding boxes on the full image
    if (person.BodyParts) {
      person.BodyParts.forEach((bodyPart) => {
        if (
          bodyPart.EquipmentDetections &&
          bodyPart.EquipmentDetections.length > 0
        ) {
          bodyPart.EquipmentDetections.forEach((equipment) => {
            if (equipment.BoundingBox) {
              // Determine detection status based on confidence threshold
              const confidence = Math.round(equipment.Confidence);
              let status = "Not Detected";

              if (confidence >= confidenceThreshold) {
                status = "Detected";
              } else if (confidence > 0) {
                status = "Indeterminate";
              }

              // Only draw bounding boxes for "Detected" and "Indeterminate" items
              if (status === "Detected" || status === "Indeterminate") {
                // Calculate equipment bounding box in full image coordinates
                const eqX = equipment.BoundingBox.Left * imgWidth;
                const eqY = equipment.BoundingBox.Top * imgHeight;
                const eqWidth = equipment.BoundingBox.Width * imgWidth;
                const eqHeight = equipment.BoundingBox.Height * imgHeight;

                // Set color based on status: Green for Detected, Yellow for Indeterminate
                const detectionColor =
                  status === "Detected" ? "#00FF00" : "#FFFF00"; // Green or Yellow
                fullCtx.strokeStyle = detectionColor;
                fullCtx.lineWidth = 3; // Slightly thicker for visibility
                fullCtx.fillStyle = detectionColor + "20"; // Semi-transparent

                // Draw rectangle
                fullCtx.fillRect(eqX, eqY, eqWidth, eqHeight);
                fullCtx.strokeRect(eqX, eqY, eqWidth, eqHeight);
              }
            }
          });
        }
      });

      // Note: Only drawing bounding boxes for detected and indeterminate items
      // Removed red indicators for missing PPE to keep visualization clean
    }

    // Now crop the person region from the annotated full image
    const fullImageBuffer = fullCanvas.toBuffer("image/png");

    // Use sharp to crop the annotated image
    const croppedAnnotatedBuffer = await sharp(fullImageBuffer)
      .extract({
        left: cropX,
        top: cropY,
        width: cropWidth,
        height: cropHeight,
      })
      .png()
      .toBuffer();

    // Save the processed image
    const fileName = `person_${person.Id}_${uuidv4()}.png`;
    const filePath = path.join(processedImagesDir, fileName);

    fs.writeFileSync(filePath, croppedAnnotatedBuffer);

    // Track the generated file for cleanup
    generatedFiles.push(filePath);

    // Return absolute URL with server port
    return `${serverUrl}/processed-images/${fileName}`;
  } catch (error) {
    console.error("Error processing person image:", error);
    return `${serverUrl}/placeholder.svg?height=120&width=120&text=Person+${person.Id}`;
  }
}

// Function to get color based on detection status
function getDetectionColor(isDetected, coversBodyPart = null) {
  // Green for positive detection (equipment detected and covers body part)
  if (isDetected && (coversBodyPart === null || coversBodyPart.Value)) {
    return "#00FF00"; // Bright green
  }

  // Orange for indeterminate (equipment detected but coverage uncertain)
  if (isDetected && coversBodyPart && !coversBodyPart.Value) {
    return "#FFA500"; // Orange
  }

  // Red for negative detection (no equipment detected)
  return "#FF0000"; // Red
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PPE Detection API is running" });
});

// PPE Detection endpoint
app.post("/api/detect", upload.single("image"), async (req, res) => {
  try {
    const imagePath = req.file.path;
    const imageBytes = fs.readFileSync(imagePath);
    const confidenceThreshold = parseFloat(req.body.confidenceThreshold) || 80;

    // Get image metadata using sharp
    const imageMetadata = await sharp(imagePath).metadata();

    const params = {
      Image: { Bytes: imageBytes },
      SummarizationAttributes: {
        MinConfidence: confidenceThreshold,
        RequiredEquipmentTypes: ["FACE_COVER", "HAND_COVER", "HEAD_COVER"],
      },
    };

    try {
      const command = new DetectProtectiveEquipmentCommand(params);
      const data = await rekognitionClient.send(command);

      // Process each person's image
      const generatedFiles = []; // Initialize array to track generated files
      const results = await Promise.all(
        (data.Persons || []).map(async (person, idx) => {
          const bodyParts = person.BodyParts || [];

          const getStatus = (type) => {
            const part = bodyParts.find((p) =>
              p.EquipmentDetections.some((eq) => eq.Type === type)
            );
            const detection =
              part && part.EquipmentDetections.find((eq) => eq.Type === type);
            return detection
              ? {
                  status: "Detected",
                  confidence: Math.round(detection.Confidence),
                }
              : {
                  status: "Not Detected",
                  confidence: part ? Math.round(part.Confidence) : 0,
                };
          };

          // Generate cropped image with equipment bounding boxes
          const processedImageUrl = await processPersonImage(
            imagePath,
            person,
            imageMetadata,
            generatedFiles, // Pass generatedFiles array
            confidenceThreshold // Pass confidence threshold for bounding box logic
          );

          return {
            personId: idx + 1,
            confidence: Math.round(person.Confidence),
            image: processedImageUrl,
            boundingBox: {
              x: person.BoundingBox.Left,
              y: person.BoundingBox.Top,
              width: person.BoundingBox.Width,
              height: person.BoundingBox.Height,
            },
            hardHat: getStatus("HEAD_COVER"),
            faceMask: getStatus("FACE_COVER"),
            handProtectionL: getStatus("HAND_COVER"),
            handProtectionR: getStatus("HAND_COVER"),
            // Note: AWS Rekognition does not detect safety vests, boots, or other specialized PPE
            // For these items, consider using Amazon Rekognition Custom Labels
            safetyVest: { status: "Not Supported", confidence: 0 },
            boots: { status: "Not Supported", confidence: 0 },
          };
        })
      );

      fs.unlinkSync(imagePath); // cleanup temp file

      res.json({
        success: true,
        data: {
          results,
          processing_time: 1.2, // Optional: replace with actual measured time
          image_metadata: {
            width: imageMetadata.width,
            height: imageMetadata.height,
            format: imageMetadata.format,
          },
        },
        message: "PPE detection completed successfully",
      });

      // Clean up generated files after a delay to allow frontend to load images
      setTimeout(() => {
        cleanupFiles(generatedFiles);
      }, 60000); // 60 seconds delay
    } catch (rekognitionError) {
      fs.unlinkSync(imagePath); // cleanup temp file
      console.error("Rekognition Error:", rekognitionError);
      return res.status(500).json({
        success: false,
        error: "Failed to process image with AWS Rekognition",
        message: rekognitionError.message,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Error processing image",
      message: error.message,
    });
  }
});

// API configuration endpoint
app.get("/api/config", (req, res) => {
  res.json({
    supported_formats: ["image/jpeg", "image/jpg", "image/png"],
    max_file_size: 10485760, // 10MB in bytes
    max_persons_per_image: 10,
    confidence_range: { min: 0, max: 100 },
  });
});

// Manual cleanup endpoint (for debugging/admin purposes)
app.post("/api/cleanup", (req, res) => {
  try {
    cleanupProcessedImages();
    res.json({
      success: true,
      message: "Cleanup completed successfully",
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({
      success: false,
      error: "Cleanup failed",
      message: error.message,
    });
  }
});

// Periodic cleanup - run every 5 minutes to clean up old files
setInterval(() => {
  try {
    if (fs.existsSync(processedImagesDir)) {
      const files = fs.readdirSync(processedImagesDir);
      const now = Date.now();

      files.forEach((file) => {
        const filePath = path.join(processedImagesDir, file);
        try {
          const stats = fs.statSync(filePath);
          // Remove files older than 2 minutes
          if (now - stats.mtime.getTime() > 120000) {
            fs.unlinkSync(filePath);
            console.log(`Periodic cleanup: removed old file ${filePath}`);
          }
        } catch (error) {
          console.error(`Error during periodic cleanup of ${filePath}:`, error);
        }
      });
    }
  } catch (error) {
    console.error("Error during periodic cleanup:", error);
  }
}, 300000); // Run every 5 minutes

app.listen(port, () => {
  console.log(`PPE Detection API Server listening at https://detection.gulfconsulting.com.au/api`);
  console.log(`Health check available at: https://detection.gulfconsulting.com.au/api/health`);
});
