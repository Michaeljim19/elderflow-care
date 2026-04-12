import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  UploadResult 
} from 'firebase/storage';
import { storage } from '@/lib/firebase';

// Allowed file types for medical attachments
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg'],
  documents: ['application/pdf'],
  all: [] as string[]
};

ALLOWED_FILE_TYPES.all = [...ALLOWED_FILE_TYPES.images, ...ALLOWED_FILE_TYPES.documents];

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Upload file to Firebase Storage
export const uploadMedicalAttachment = async (
  file: File, 
  patientId: string, 
  medicalHistoryId: string
): Promise<string> => {
  try {
    // Validate file type
    if (!ALLOWED_FILE_TYPES.all.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed. Please use a JPEG image or PDF document.`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    // Create a unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Create storage reference
    const storageRef = ref(storage, `medical-attachments/${patientId}/${medicalHistoryId}/${fileName}`);
    
    // Upload file
    const uploadResult: UploadResult = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    return downloadURL;
    
  } catch (error) {
    console.error('Error uploading medical attachment:', error);
    throw error;
  }
};

// Upload multiple files
export const uploadMultipleMedicalAttachments = async (
  files: File[], 
  patientId: string, 
  medicalHistoryId: string,
  onProgress?: (progress: number, fileName: string) => void
): Promise<string[]> => {
  try {
    const uploadPromises = files.map(async (file, index) => {
      if (onProgress) {
        onProgress((index / files.length) * 100, file.name);
      }
      return await uploadMedicalAttachment(file, patientId, medicalHistoryId);
    });
    
    const downloadURLs = await Promise.all(uploadPromises);
    
    if (onProgress) {
      onProgress(100, 'All files uploaded');
    }
    
    return downloadURLs;
    
  } catch (error) {
    console.error('Error uploading multiple medical attachments:', error);
    throw error;
  }
};

// Delete file from Firebase Storage
export const deleteMedicalAttachment = async (downloadURL: string): Promise<void> => {
  try {
    // Create reference from URL
    const storageRef = ref(storage, downloadURL);
    
    // Delete the file
    await deleteObject(storageRef);
    
  } catch (error) {
    console.error('Error deleting medical attachment:', error);
    throw error;
  }
};

// Get file info from URL
export const getFileInfoFromURL = (downloadURL: string) => {
  try {
    const url = new URL(downloadURL);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const decodedFileName = decodeURIComponent(fileName);
    
    // Extract original filename (remove timestamp prefix)
    const originalFileName = decodedFileName.replace(/^\d+_/, '');
    
    // Determine file type
    const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    const isDocument = ['pdf', 'doc', 'docx'].includes(fileExtension);
    
    return {
      fileName: originalFileName,
      isImage,
      isDocument,
      fileExtension,
      downloadURL
    };
    
  } catch (error) {
    console.error('Error parsing file URL:', error);
    return {
      fileName: 'Unknown file',
      isImage: false,
      isDocument: false,
      fileExtension: '',
      downloadURL
    };
  }
};

// Validate file before upload
export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.all.includes(file.type)) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not allowed. Please use a JPEG image or PDF document.`
    };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    };
  }
  
  // Check if file name is valid
  if (file.name.length === 0) {
    return {
      isValid: false,
      error: 'File name cannot be empty.'
    };
  }
  
  return { isValid: true };
};
