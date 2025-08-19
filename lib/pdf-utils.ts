import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { DetectionResult } from "./api";

interface PDFGenerationOptions {
  results: DetectionResult[];
  originalImage?: string;
  confidence: number;
  timestamp?: Date;
}

export async function generatePPEDetectionPDF(
  options: PDFGenerationOptions
): Promise<void> {
  const {
    results,
    originalImage,
    confidence,
    timestamp = new Date(),
  } = options;

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  // Add title and header with better styling
  pdf.setFillColor(52, 73, 94); // Dark blue background
  pdf.rect(0, 0, pageWidth, 35, "F");

  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text("GULF CONSULTING", pageWidth / 2, currentY + 5, { align: "center" });
  currentY += 12;

  pdf.setFontSize(18);
  pdf.text("PPE DETECTION REPORT", pageWidth / 2, currentY, {
    align: "center",
  });
  currentY += 20;

  // Reset text color for body
  pdf.setTextColor(0, 0, 0);

  // Add report metadata in a styled box
  pdf.setFillColor(248, 249, 250); // Light gray background
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(margin, currentY, pageWidth - 2 * margin, 25, "FD");

  currentY += 5;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("REPORT DETAILS", margin + 5, currentY + 5);

  pdf.setFont("helvetica", "normal");
  currentY += 8;
  pdf.text(`Generated: ${timestamp.toLocaleString()}`, margin + 5, currentY);
  currentY += 6;
  pdf.text(`Confidence Threshold: ${confidence}%`, margin + 5, currentY);
  pdf.text(`Persons Detected: ${results.length}`, margin + 80, currentY);
  currentY += 15;

  // Add original image if available
  if (originalImage) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = originalImage;
      });

      // Section title for original image
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(52, 73, 94);
      pdf.text("ORIGINAL IMAGE", margin, currentY);
      currentY += 8;

      // Calculate image dimensions to fit on page
      const maxWidth = pageWidth - 2 * margin;
      const maxHeight = 90; // Max height for the original image
      const aspectRatio = img.width / img.height;

      let imgWidth = maxWidth;
      let imgHeight = imgWidth / aspectRatio;

      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * aspectRatio;
      }

      // Center the image
      const imgX = (pageWidth - imgWidth) / 2;

      // Add border around original image
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(1);
      pdf.rect(imgX - 2, currentY - 2, imgWidth + 4, imgHeight + 4, "S");

      pdf.addImage(originalImage, "JPEG", imgX, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 20;
    } catch (error) {
      console.warn("Could not add original image to PDF:", error);
      pdf.setTextColor(255, 0, 0);
      pdf.text("Original image could not be included", margin, currentY);
      pdf.setTextColor(0, 0, 0);
      currentY += 15;
    }
  }

  // Detection results section title
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(52, 73, 94);
  pdf.text("DETECTION RESULTS", margin, currentY);
  currentY += 15;

  // Add detection results for each person
  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    // Check if we need a new page (allow more space for each person)
    if (currentY > pageHeight - 140) {
      pdf.addPage();
      currentY = margin + 15;
    }

    // Create a professional card for each person
    const cardHeight = 100;
    const cardWidth = pageWidth - 2 * margin;

    // Card background with shadow effect
    pdf.setFillColor(255, 255, 255); // White background
    pdf.setDrawColor(220, 220, 220); // Light gray border
    pdf.setLineWidth(0.5);
    pdf.rect(margin, currentY, cardWidth, cardHeight, "FD");

    // Card shadow
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin + 2, currentY + 2, cardWidth, cardHeight, "F");
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin, currentY, cardWidth, cardHeight, "FD");

    // Person header with styled background
    pdf.setFillColor(41, 128, 185); // Blue header
    pdf.rect(margin, currentY, cardWidth, 18, "F");

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255); // White text
    pdf.text(
      `Person ${result.personId} (Detection Confidence: ${result.confidence}%)`,
      margin + 8,
      currentY + 12
    );

    let contentY = currentY + 25;

    // Add person image if available
    if (result.image) {
      try {
        const personImg = new Image();
        personImg.crossOrigin = "anonymous";

        await new Promise((resolve, reject) => {
          personImg.onload = resolve;
          personImg.onerror = reject;
          personImg.src = result.image;
        });

        // Calculate person image dimensions - make it larger and properly sized
        const maxPersonImgWidth = 70;
        const maxPersonImgHeight = 65;
        const personAspectRatio = personImg.width / personImg.height;

        let personImgWidth = maxPersonImgWidth;
        let personImgHeight = personImgWidth / personAspectRatio;

        if (personImgHeight > maxPersonImgHeight) {
          personImgHeight = maxPersonImgHeight;
          personImgWidth = personImgHeight * personAspectRatio;
        }

        // Add image with nice border
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(1);
        pdf.rect(margin + 8, contentY, personImgWidth, personImgHeight, "S");
        pdf.addImage(
          result.image,
          "JPEG",
          margin + 8,
          contentY,
          personImgWidth,
          personImgHeight
        );

        // Create professional table next to the image
        const tableX = margin + personImgWidth + 20;
        const tableY = contentY;
        const tableWidth = cardWidth - personImgWidth - 35;
        const rowHeight = 12;

        // Table header with dark background
        pdf.setFillColor(52, 73, 94);
        pdf.rect(tableX, tableY, tableWidth, rowHeight + 2, "F");

        // Column widths
        const col1Width = tableWidth * 0.45;
        const col2Width = tableWidth * 0.3;
        const col3Width = tableWidth * 0.25;

        // Header text
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text("PPE Item", tableX + 3, tableY + 8);
        pdf.text("Status", tableX + col1Width + 3, tableY + 8);
        pdf.text("Confidence", tableX + col1Width + col2Width + 3, tableY + 8);

        // Vertical lines for columns
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.line(
          tableX + col1Width,
          tableY,
          tableX + col1Width,
          tableY + (rowHeight + 2) + rowHeight * 4
        );
        pdf.line(
          tableX + col1Width + col2Width,
          tableY,
          tableX + col1Width + col2Width,
          tableY + (rowHeight + 2) + rowHeight * 4
        );

        // Data rows
        const ppeItems = [
          { name: "Hard Hat", data: result.hardHat },
          { name: "Face Mask", data: result.faceMask },
          { name: "Hand Protection (L)", data: result.handProtectionL },
          { name: "Hand Protection (R)", data: result.handProtectionR },
        ];

        let rowY = tableY + rowHeight + 2;
        ppeItems.forEach((item, index) => {
          // Alternating row colors
          if (index % 2 === 0) {
            pdf.setFillColor(248, 249, 250);
          } else {
            pdf.setFillColor(255, 255, 255);
          }
          pdf.rect(tableX, rowY, tableWidth, rowHeight, "F");

          // Row border
          pdf.setDrawColor(230, 230, 230);
          pdf.setLineWidth(0.2);
          pdf.rect(tableX, rowY, tableWidth, rowHeight, "S");

          // Item name
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
          pdf.text(item.name, tableX + 3, rowY + 8);

          // Status with color coding
          const statusColor = getStatusColor(item.data.status);
          pdf.setTextColor(statusColor.r, statusColor.g, statusColor.b);
          pdf.setFont("helvetica", "bold");
          pdf.text(item.data.status, tableX + col1Width + 3, rowY + 8);

          // Confidence percentage
          pdf.setTextColor(0, 0, 0);
          pdf.setFont("helvetica", "normal");
          pdf.text(
            `${item.data.confidence}%`,
            tableX + col1Width + col2Width + 3,
            rowY + 8
          );

          rowY += rowHeight;
        });

        // Table outer border
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.5);
        pdf.rect(
          tableX,
          tableY,
          tableWidth,
          rowHeight + 2 + rowHeight * 4,
          "S"
        );
      } catch (error) {
        console.warn(
          `Could not add image for person ${result.personId}:`,
          error
        );
        // Fallback to text-only results with improved formatting
        addTextOnlyResultsImproved(
          pdf,
          result,
          margin + 8,
          contentY,
          cardWidth - 16
        );
      }
    } else {
      // No image available, add text-only results with improved formatting
      addTextOnlyResultsImproved(
        pdf,
        result,
        margin + 8,
        contentY,
        cardWidth - 16
      );
    }

    currentY += cardHeight + 15;
  }

  // Add footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Page ${i} of ${totalPages} - Generated by Gulf Consulting PPE Detection System`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Generate filename with timestamp
  const filename = `PPE_Detection_Report_${
    timestamp.toISOString().split("T")[0]
  }_${timestamp.toTimeString().split(" ")[0].replace(/:/g, "-")}.pdf`;

  // Save the PDF
  pdf.save(filename);
}

function addTextOnlyResultsImproved(
  pdf: jsPDF,
  result: DetectionResult,
  x: number,
  y: number,
  width: number
): void {
  const rowHeight = 12;
  const tableWidth = width;

  // Table header
  pdf.setFillColor(52, 73, 94);
  pdf.rect(x, y, tableWidth, rowHeight + 2, "F");

  // Column widths
  const col1Width = tableWidth * 0.45;
  const col2Width = tableWidth * 0.3;
  const col3Width = tableWidth * 0.25;

  // Header text
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("PPE Item", x + 3, y + 8);
  pdf.text("Status", x + col1Width + 3, y + 8);
  pdf.text("Confidence", x + col1Width + col2Width + 3, y + 8);

  // Vertical lines for columns
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(
    x + col1Width,
    y,
    x + col1Width,
    y + (rowHeight + 2) + rowHeight * 4
  );
  pdf.line(
    x + col1Width + col2Width,
    y,
    x + col1Width + col2Width,
    y + (rowHeight + 2) + rowHeight * 4
  );

  // Data rows
  const ppeItems = [
    { name: "Hard Hat", data: result.hardHat },
    { name: "Face Mask", data: result.faceMask },
    { name: "Hand Protection (L)", data: result.handProtectionL },
    { name: "Hand Protection (R)", data: result.handProtectionR },
  ];

  let rowY = y + rowHeight + 2;
  ppeItems.forEach((item, index) => {
    // Alternating row colors
    if (index % 2 === 0) {
      pdf.setFillColor(248, 249, 250);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(x, rowY, tableWidth, rowHeight, "F");

    // Row border
    pdf.setDrawColor(230, 230, 230);
    pdf.setLineWidth(0.2);
    pdf.rect(x, rowY, tableWidth, rowHeight, "S");

    // Item name
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    pdf.text(item.name, x + 3, rowY + 8);

    // Status with color coding
    const statusColor = getStatusColor(item.data.status);
    pdf.setTextColor(statusColor.r, statusColor.g, statusColor.b);
    pdf.setFont("helvetica", "bold");
    pdf.text(item.data.status, x + col1Width + 3, rowY + 8);

    // Confidence percentage
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `${item.data.confidence}%`,
      x + col1Width + col2Width + 3,
      rowY + 8
    );

    rowY += rowHeight;
  });

  // Table outer border
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.5);
  pdf.rect(x, y, tableWidth, rowHeight + 2 + rowHeight * 4, "S");
}

function getStatusColor(status: string): { r: number; g: number; b: number } {
  switch (status) {
    case "Detected":
      return { r: 0, g: 128, b: 0 }; // Green
    case "Not Detected":
      return { r: 255, g: 0, b: 0 }; // Red
    case "Indeterminate":
      return { r: 255, g: 165, b: 0 }; // Orange
    default:
      return { r: 0, g: 0, b: 0 }; // Black
  }
}

// Alternative function for capturing HTML elements as images
export async function captureElementAsPDF(
  elementId: string,
  filename: string = "ppe-detection-report.pdf"
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.8);
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate dimensions to fit the content
    const canvasAspectRatio = canvas.width / canvas.height;
    const pdfAspectRatio = pageWidth / pageHeight;

    let imgWidth = pageWidth;
    let imgHeight = pageWidth / canvasAspectRatio;

    if (imgHeight > pageHeight) {
      imgHeight = pageHeight;
      imgWidth = pageHeight * canvasAspectRatio;
    }

    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}
