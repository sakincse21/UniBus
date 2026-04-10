/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { uploadRoutePointsExcel } from "@/lib/action/route";
import { toast } from "sonner";
import { Upload, AlertCircle, CheckCircle, Loader } from "lucide-react";

interface RouteExcelUploadProps {
  routeId: number;
  onSuccess?: (data: any) => void;
}

export const RouteExcelUpload = ({
  routeId,
  onSuccess,
}: RouteExcelUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Only .xlsx or .xls files are allowed");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setUploadSuccess(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Uploading and processing Excel file...");

    try {
      const res = await uploadRoutePointsExcel(routeId, file);

      if (res.success) {
        toast.success(`${res.data.message}`, { id: toastId });
        setSuccessMessage(res.data.message);
        setUploadSuccess(true);
        setFile(null);
        
        // Reset success message after 5 seconds
        setTimeout(() => {
          setUploadSuccess(false);
          setSuccessMessage("");
        }, 5000);

        if (onSuccess) {
          onSuccess(res.data);
        }
      } else {
        toast.error(res.message || "Failed to upload route points", {
          id: toastId,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to upload file", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Route Points from Excel
        </CardTitle>
        <CardDescription>
          Upload an Excel file to quickly replace all route points. The file
          should contain columns: sequence, lat, lng, minuteOffset (optional)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Excel Format Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-2">Excel Format Required:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong>sequence</strong>: Order number (1, 2, 3, ...)
                </li>
                <li>
                  <strong>lat</strong>: Latitude (-90 to 90)
                </li>
                <li>
                  <strong>lng</strong>: Longitude (-180 to 180)
                </li>
                <li>
                  <strong>minuteOffset</strong>: Minutes from start (optional,
                  default: 0)
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {uploadSuccess && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-900 dark:text-green-200">
              <p className="font-semibold">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Drag and Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {file ? `Selected: ${file.name}` : "Drag and drop your Excel file here"}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                or click below to browse
              </p>
            </div>
          </div>
        </div>

        {/* File Input */}
        <Input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="cursor-pointer"
        />

        {/* File Info */}
        {file && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>
              <strong>File:</strong> {file.name}
            </p>
            <p>
              <strong>Size:</strong> {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Route Points
              </>
            )}
          </Button>
          {file && (
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setUploadSuccess(false);
              }}
              disabled={loading}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>• This will replace all existing route points for this route</p>
          <p>• File is automatically deleted after processing</p>
          <p>• Maximum file size: 10MB</p>
        </div>
      </CardContent>
    </Card>
  );
};
