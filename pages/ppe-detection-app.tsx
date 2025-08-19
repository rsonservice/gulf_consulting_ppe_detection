"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  ArrowDown,
  ArrowUp,
  FileText,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Image from "next/image";
import {
  ppeAPI,
  APIError,
  DetectionResult,
  validateImageFile,
  fileToBase64,
} from "@/lib/api";
import { generatePPEDetectionPDF } from "@/lib/pdf-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PPEDetectionApp() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [confidence, setConfidence] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dummyImage] = useState<string>(
    "/placeholder.svg?height=300&width=400&text=Sample+PPE+Detection+Image"
  );

  // Check API connectivity on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await ppeAPI.healthCheck();
        setIsConnected(true);
        setError(null);
      } catch (error) {
        setIsConnected(false);
        if (error instanceof APIError) {
          setError(`API Connection Error: ${error.message}`);
        } else {
          setError("Unable to connect to PPE Detection API");
        }
      }
    };

    checkConnection();
  }, []);

  const processFileUpload = async (file: File) => {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      return;
    }

    try {
      // Convert to base64 for preview
      const base64 = await fileToBase64(file);
      setUploadedFile(file);
      setUploadedImage(base64);
      setResults([]); // Clear previous results
      setError(null); // Clear any previous errors
    } catch (error) {
      setError("Error processing file");
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        processFileUpload(file);
      } else {
        setError("Please upload a valid image file (JPEG or PNG)");
      }
    }
  };

  // Function to process detection results and apply threshold logic
  const processDetectionResults = (
    results: DetectionResult[],
    threshold: number
  ): DetectionResult[] => {
    return results.map((result) => {
      const processedResult = { ...result };

      // Check each PPE item against the threshold
      ["hardHat", "faceMask", "handProtectionL", "handProtectionR"].forEach(
        (ppeItem) => {
          const item = processedResult[ppeItem as keyof DetectionResult] as any;
          if (item && typeof item === "object" && "confidence" in item) {
            // If confidence is below threshold and status is "Detected", mark as "Indeterminate"
            if (item.confidence < threshold && item.status === "Detected") {
              item.status = "Indeterminate";
            }
          }
        }
      );

      return processedResult;
    });
  };

  const processImage = async () => {
    if (!uploadedFile || !uploadedImage) {
      setError("Please upload an image first");
      return;
    }

    if (!isConnected) {
      setError("Not connected to API. Please check your backend server.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Call the actual API
      const response = await ppeAPI.detectPPE(uploadedFile, confidence);

      if (response.success && response.data.results) {
        // Process results to apply threshold logic for indeterminate status
        const processedResults = processDetectionResults(
          response.data.results,
          confidence
        );
        setResults(processedResults);
        setError(null);
      } else {
        setError(response.error || "Detection failed");
        setResults([]);
      }
    } catch (error) {
      console.error("PPE Detection Error:", error);
      if (error instanceof APIError) {
        setError(`API Error: ${error.message}`);
      } else {
        setError("An unexpected error occurred during processing");
      }
      setResults([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Detected":
        return "text-green-600";
      case "Not Detected":
        return "text-red-600";
      case "Indeterminate":
        return "text-yellow-600 font-bold";
      default:
        return "text-gray-600";
    }
  };

  const increaseConfidence = () => {
    setConfidence((prev) => Math.min(95, prev + 5));
  };

  const decreaseConfidence = () => {
    setConfidence((prev) => Math.max(50, prev - 5));
  };

  const handlePrintToPDF = async () => {
    if (results.length === 0) {
      setError("No detection results to print. Please process an image first.");
      return;
    }

    try {
      await generatePPEDetectionPDF({
        results,
        originalImage: uploadedImage || undefined,
        confidence,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b-2 border-gray-300 shadow-sm mb-8">
          <div className="max-w-7xl mx-auto px-4 py-6 relative">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                GULF CONSULTING
              </h1>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                PPE DETECTION SYSTEM
              </h1>
            </div>
            {/* Logo in top right corner */}
            <div className="absolute top-6 right-5">
              <Image
                src="/logo.jpg"
                alt="Gulf Consulting Logo"
                width={135}
                height={135}
                className="object-contain"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card className="border-2 border-black">
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 border border-gray-300 text-sm">
                <p className="font-semibold mb-2">
                  Detection of Personal Protective Equipment (PPE) covering
                  Head, Face and Hands
                </p>
                <div className="space-y-1">
                  <p className="font-semibold">Instructions:</p>
                  <p>
                    1. Drag and drop an image or video (Image must be .jpeg or
                    .png. Video must be .mp4 or .mov).
                  </p>
                  <p>
                    2. Select the required minimum confidence threshold (50 –
                    95%) regarding the detection of PPE on a body part to be
                    included in the summary results.
                  </p>
                  <p>3. Click "Go" to see detection results.</p>
                </div>
              </div>

              {/* Image Upload Area */}
              <div
                className="border-4 border-blue-400 border-dashed rounded-lg p-6 text-center bg-blue-50"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {uploadedImage ? (
                  <div className="relative group">
                    <div
                      className="cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Image
                        src={uploadedImage || "/placeholder.svg"}
                        alt="Uploaded image"
                        width={400}
                        height={300}
                        className="mx-auto rounded-lg object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600">
                      Drag and drop an image or video here
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Supports .jpeg, .png, .mp4, .mov formats
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Label htmlFor="confidence" className="font-semibold">
                    Required confidence
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="confidence"
                      type="number"
                      value={confidence}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                      className="w-20 text-center"
                      min="50"
                      max="95"
                    />
                    <span>%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={decreaseConfidence}
                      className="p-1 bg-transparent"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={increaseConfidence}
                      className="p-1 bg-transparent"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={processImage}
                  disabled={!uploadedImage || isProcessing || !isConnected}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 py-2 disabled:opacity-50"
                >
                  {isProcessing
                    ? "Processing..."
                    : isConnected === false
                    ? "API Disconnected"
                    : "GO"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="border-2 border-black contain-size">
            <CardContent className="space-y-4 h-full flex flex-col">
              {results.length > 0 ? (
                <>
                  {/* Individual Person Detection Results */}
                  <div className="border border-gray-300 bg-white flex-1 overflow-hidden flex flex-col">
                    <h3 className="font-semibold p-3 border-b bg-gray-50">
                      Detection Results
                    </h3>
                    <div className="overflow-y-auto p-3 space-y-4 flex-1">
                      {results.map((result) => (
                        <div
                          key={result.personId}
                          className="flex space-x-4 border border-gray-200 p-3 bg-white rounded"
                        >
                          {/* Person Image */}
                          <div className="flex-shrink-0">
                            <Image
                              src={result.image || "/placeholder.svg"}
                              alt={`Person ${result.personId} with PPE detection`}
                              width={120}
                              height={120}
                              className="rounded object-cover border"
                            />
                          </div>

                          {/* Detection Results Table */}
                          <div className="flex-1 border border-gray-300 p-3 bg-gray-50">
                            <h4 className="font-bold text-lg mb-3">
                              Person ID: {result.personId} ({result.confidence}
                              %)
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">Hard Hat –</span>
                                <span
                                  className={`font-semibold ${getStatusColor(
                                    result.hardHat.status
                                  )}`}
                                >
                                  {result.hardHat.status} (
                                  {result.hardHat.confidence}%)
                                </span>
                              </div>

                              <div className="flex justify-between">
                                <span className="font-medium">Face Mask –</span>
                                <span
                                  className={`font-semibold ${getStatusColor(
                                    result.faceMask.status
                                  )}`}
                                >
                                  {result.faceMask.status} (
                                  {result.faceMask.confidence}%)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  Hand Protection (L) –
                                </span>
                                <span
                                  className={`font-semibold ${getStatusColor(
                                    result.handProtectionL.status
                                  )}`}
                                >
                                  {result.handProtectionL.status} (
                                  {result.handProtectionL.confidence}%)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">
                                  Hand Protection (R) –
                                </span>
                                <span
                                  className={`font-semibold ${getStatusColor(
                                    result.handProtectionR.status
                                  )}`}
                                >
                                  {result.handProtectionR.status} (
                                  {result.handProtectionR.confidence}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Print to PDF Button */}
                  <div className="text-right">
                    <Button
                      onClick={handlePrintToPDF}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 py-2"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Print to PDF
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500"></div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
