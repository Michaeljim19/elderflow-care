import React, { useState, useRef } from 'react';
import { Upload, X, File, Image, Loader2, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  validateFile, 
  ALLOWED_FILE_TYPES, 
  MAX_FILE_SIZE,
  getFileInfoFromURL 
} from '@/services/firebase/storage';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  selectedFiles: File[];
  existingFiles?: string[]; // URLs of existing files
  onExistingFileRemove?: (url: string) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  onFileRemove,
  selectedFiles,
  existingFiles = [],
  onExistingFileRemove,
  multiple = true,
  accept,
  maxFiles = 10,
  disabled = false,
  className = ""
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  // Get accepted file types
  const acceptedTypes = accept || ALLOWED_FILE_TYPES.all.join(',');

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check total file count
    const totalFiles = selectedFiles.length + existingFiles.length + fileArray.length;
    if (totalFiles > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed. Currently have ${selectedFiles.length + existingFiles.length} files.`,
        variant: "destructive"
      });
      return;
    }

    // Validate each file
    fileArray.forEach((file) => {
      const validation = validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    // Show errors if any
    if (errors.length > 0) {
      toast({
        title: "Some files were rejected",
        description: errors.join('\n'),
        variant: "destructive"
      });
    }

    // Add valid files
    if (validFiles.length > 0) {
      if (multiple) {
        onFilesSelected([...selectedFiles, ...validFiles]);
      } else {
        onFilesSelected(validFiles.slice(0, 1));
      }
    }
  };

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
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File | string) => {
    let isImage = false;
    let fileName = '';

    if (typeof file === 'string') {
      const fileInfo = getFileInfoFromURL(file);
      isImage = fileInfo.isImage;
      fileName = fileInfo.fileName;
    } else {
      isImage = file.type.startsWith('image/');
      fileName = file.name;
    }

    return isImage ? (
      <Image className="h-4 w-4 text-blue-500" />
    ) : (
      <File className="h-4 w-4 text-gray-500" />
    );
  };

  const renderFilePreview = (file: File, index: number) => (
    <Card key={`new-${index}`} className="relative">
      <CardContent className="p-3">
        <div className="flex items-center space-x-3">
          {getFileIcon(file)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFileRemove(index)}
            className="h-6 w-6 p-0 hover:bg-red-100"
            disabled={disabled}
          >
            <X className="h-3 w-3 text-red-500" />
          </Button>
        </div>
        {file.type.startsWith('image/') && (
          <div className="mt-2">
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="max-w-full h-20 object-cover rounded border"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderExistingFile = (url: string, index: number) => {
    const fileInfo = getFileInfoFromURL(url);
    
    return (
      <Card key={`existing-${index}`} className="relative">
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            {getFileIcon(url)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {fileInfo.fileName}
              </p>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  Uploaded
                </Badge>
                <Check className="h-3 w-3 text-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(url, '_blank')}
                className="h-6 w-6 p-0 hover:bg-blue-100"
                title="View file"
              >
                <File className="h-3 w-3 text-blue-500" />
              </Button>
              {onExistingFileRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExistingFileRemove(url)}
                  className="h-6 w-6 p-0 hover:bg-red-100"
                  disabled={disabled}
                  title="Remove file"
                >
                  <X className="h-3 w-3 text-red-500" />
                </Button>
              )}
            </div>
          </div>
          {fileInfo.isImage && (
            <div className="mt-2">
              <img
                src={url}
                alt={fileInfo.fileName}
                className="max-w-full h-20 object-cover rounded border"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="space-y-2">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              {dragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500">
              Images (JPG, PNG, GIF, WebP) or Documents (PDF, DOC, DOCX)
            </p>
            <p className="text-xs text-gray-500">
              Max file size: {formatFileSize(MAX_FILE_SIZE)} • Max {maxFiles} files
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {(existingFiles.length > 0 || selectedFiles.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Attachments ({existingFiles.length + selectedFiles.length}/{maxFiles})
          </h4>
          
          {/* Existing Files */}
          {existingFiles.map((url, index) => renderExistingFile(url, index))}
          
          {/* Selected Files */}
          {selectedFiles.map((file, index) => renderFilePreview(file, index))}
        </div>
      )}

      {/* File Type Information */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>Supported formats:</span>
        </div>
        <ul className="ml-4 space-y-0.5">
          <li>• <strong>Images:</strong> JPEG, PNG, GIF, WebP</li>
          <li>• <strong>Documents:</strong> PDF, DOC, DOCX</li>
          <li>• <strong>Maximum size:</strong> {formatFileSize(MAX_FILE_SIZE)} per file</li>
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;
