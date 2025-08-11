// API configuration and utilities for PPE Detection Backend
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://18.191.195.85:8000/api";

// Types for API requests and responses
export interface PPEDetectionRequest {
  image: string | File;
  confidence_threshold: number;
}

export interface PPEDetectionResponse {
  success: boolean;
  data: {
    results: DetectionResult[];
    processing_time: number;
    image_metadata?: {
      width: number;
      height: number;
      format: string;
    };
  };
  message?: string;
  error?: string;
}

export interface DetectionResult {
  personId: number;
  confidence: number;
  image: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  hardHat: {
    status: "Detected" | "Not Detected" | "Indeterminate";
    confidence: number;
  };
  goggles: {
    status: "Detected" | "Not Detected" | "Indeterminate";
    confidence: number;
  };
  faceMask: {
    status: "Detected" | "Not Detected" | "Indeterminate";
    confidence: number;
  };
  handProtectionL: {
    status: "Detected" | "Not Detected" | "Indeterminate";
    confidence: number;
  };
  handProtectionR: {
    status: "Detected" | "Not Detected" | "Indeterminate";
    confidence: number;
  };
}

// API Error class
export class APIError extends Error {
  constructor(message: string, public status?: number, public data?: any) {
    super(message);
    this.name = "APIError";
  }
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const config = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.message || `HTTP error! status: ${response.status}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network or other errors
    throw new APIError(
      `Network error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Convert File or base64 string to FormData for image upload
function createFormData(
  image: string | File,
  confidenceThreshold: number
): FormData {
  const formData = new FormData();

  if (typeof image === "string") {
    // Convert base64 to blob
    const base64Data = image.split(",")[1] || image;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/jpeg" });
    formData.append("image", blob, "uploaded_image.jpg");
  } else {
    formData.append("image", image);
  }

  formData.append("confidence_threshold", confidenceThreshold.toString());
  return formData;
}

// Main API functions
export const ppeAPI = {
  // Detect PPE in uploaded image
  async detectPPE(
    image: string | File,
    confidenceThreshold: number = 80
  ): Promise<PPEDetectionResponse> {
    const formData = createFormData(image, confidenceThreshold);

    return apiRequest<PPEDetectionResponse>("/detect", {
      method: "POST",
      headers: {}, // Remove Content-Type to let browser set it for FormData
      body: formData,
    });
  },

  // Health check endpoint
  async healthCheck(): Promise<{ status: string; version?: string }> {
    return apiRequest<{ status: string; version?: string }>("/health");
  },

  // Get API configuration/capabilities
  async getConfig(): Promise<{
    supported_formats: string[];
    max_file_size: number;
    max_persons_per_image: number;
    confidence_range: { min: number; max: number };
  }> {
    return apiRequest("/config");
  },
};

// Utility function to convert File to base64 (for preview purposes)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

// Utility function to validate image file
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a JPEG or PNG image.",
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File too large. Please upload an image smaller than 10MB.",
    };
  }

  return { valid: true };
}
