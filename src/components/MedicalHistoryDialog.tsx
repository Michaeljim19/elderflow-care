import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  FileText, 
  Loader2,
  AlertCircle,
  Download,
  Eye,
  Image,
  Camera,
  X
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/ui/file-upload";
import { MedicalHistory, Patient } from "@/types";
import { 
  getMedicalHistoryByPatient,
  addMedicalHistoryWithAttachments,
  updateMedicalHistoryWithAttachments,
  deleteMedicalHistoryWithAttachments
} from "@/services/firebase/medicalHistory";
import { getFileInfoFromURL } from "@/services/firebase/storage";

interface MedicalHistoryDialogProps {
  patient: Patient;
  trigger?: React.ReactNode;
}

interface MedicalHistoryFormData {
  condition: string;
  description: string;
  date_diagnosed: string;
  treatment: string;
}

const MedicalHistoryDialog: React.FC<MedicalHistoryDialogProps> = ({
  patient,
  trigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [medicalHistories, setMedicalHistories] = useState<MedicalHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ progress: number; fileName: string } | null>(null);
  
  // File viewing state
  const [viewingFile, setViewingFile] = useState<{ url: string; fileName: string; isImage: boolean } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<MedicalHistoryFormData>({
    condition: '',
    description: '',
    date_diagnosed: '',
    treatment: ''
  });
  
  // File handling state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Load medical histories when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadMedicalHistories();
    }
  }, [isOpen, patient.patient_id]);

  const loadMedicalHistories = async () => {
    try {
      setLoading(true);
      const histories = await getMedicalHistoryByPatient(patient.patient_id);
      setMedicalHistories(histories);
    } catch (error) {
      console.error('Error loading medical histories:', error);
      toast({
        title: "Error",
        description: "Failed to load medical histories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      condition: '',
      description: '',
      date_diagnosed: '',
      treatment: ''
    });
    setSelectedFiles([]);
    setExistingFiles([]);
    setRemovedFiles([]);
    setEditingId(null);
    setIsAddFormOpen(false);
    setUploadProgress(null);
  };

  const handleInputChange = (field: keyof MedicalHistoryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExistingFileRemove = (url: string) => {
    setExistingFiles(prev => prev.filter(f => f !== url));
    setRemovedFiles(prev => [...prev, url]);
  };

  const handleViewFile = (url: string) => {
    console.log('Viewing file:', url); // Debug log
    const fileInfo = getFileInfoFromURL(url);
    console.log('File info:', fileInfo); // Debug log
    const newViewingFile = {
      url,
      fileName: fileInfo.fileName,
      isImage: fileInfo.isImage
    };
    console.log('Setting viewingFile to:', newViewingFile); // Debug log
    setViewingFile(newViewingFile);
  };

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera by default
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        setSelectedFiles(prev => [...prev, ...Array.from(files)]);
        toast({
          title: "Photo Captured",
          description: `${files.length} photo(s) added to attachments`,
        });
      }
    };
    input.click();
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,.doc,.docx';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // Validate files before adding
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];
        
        Array.from(files).forEach(file => {
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          const isValidImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');
          const isValidDoc = ['pdf', 'doc', 'docx'].includes(fileExtension || '');
          
          if (isValidImage || isValidDoc) {
            if (file.size <= 10 * 1024 * 1024) { // 10MB limit
              validFiles.push(file);
            } else {
              invalidFiles.push(`${file.name} (too large)`);
            }
          } else {
            invalidFiles.push(`${file.name} (invalid format)`);
          }
        });
        
        if (validFiles.length > 0) {
          setSelectedFiles(prev => [...prev, ...validFiles]);
          toast({
            title: "Files Added",
            description: `${validFiles.length} file(s) added to attachments`,
          });
        }
        
        if (invalidFiles.length > 0) {
          toast({
            title: "Some files rejected",
            description: invalidFiles.join(', '),
            variant: "destructive"
          });
        }
      }
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!formData.condition || !formData.description || !formData.date_diagnosed) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (condition, description, and date)",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const medicalHistoryData = {
        patient_id: patient.patient_id,
        condition: formData.condition,
        description: formData.description,
        date_diagnosed: formData.date_diagnosed,
        treatment: formData.treatment
      };

      if (editingId) {
        // Update existing record
        await updateMedicalHistoryWithAttachments(
          editingId,
          medicalHistoryData,
          selectedFiles,
          removedFiles,
          (progress, fileName) => setUploadProgress({ progress, fileName })
        );
        
        toast({
          title: "Success",
          description: "Medical history updated successfully"
        });
      } else {
        // Create new record
        await addMedicalHistoryWithAttachments(
          medicalHistoryData,
          selectedFiles,
          (progress, fileName) => setUploadProgress({ progress, fileName })
        );
        
        toast({
          title: "Success",
          description: "Medical history added successfully"
        });
      }

      // Reload the list and reset form
      await loadMedicalHistories();
      resetForm();
      
    } catch (error) {
      console.error('Error saving medical history:', error);
      toast({
        title: "Error",
        description: "Failed to save medical history",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleEdit = (history: MedicalHistory) => {
    setFormData({
      condition: history.condition,
      description: history.description,
      date_diagnosed: history.date_diagnosed,
      treatment: history.treatment
    });
    setExistingFiles(history.attachments || []);
    setSelectedFiles([]);
    setRemovedFiles([]);
    setEditingId(history.history_id);
    setIsAddFormOpen(true);
  };

  const handleDelete = async (historyId: string) => {
    if (!confirm('Are you sure you want to delete this medical history record and all its attachments?')) {
      return;
    }

    try {
      await deleteMedicalHistoryWithAttachments(historyId);
      await loadMedicalHistories();
      
      toast({
        title: "Success",
        description: "Medical history deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting medical history:', error);
      toast({
        title: "Error",
        description: "Failed to delete medical history",
        variant: "destructive"
      });
    }
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAddFormOpen(true);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderAttachments = (attachments: string[] = []) => {
    if (attachments.length === 0) return null;

    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Attachments ({attachments.length})
          </h5>
          <Badge variant="secondary" className="text-xs">
            {attachments.length} file{attachments.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {attachments.map((url, index) => {
            const fileInfo = getFileInfoFromURL(url);
            const isImage = fileInfo.isImage;
            const isPDF = fileInfo.fileExtension.toLowerCase() === 'pdf';
            
            return (
              <div 
                key={index} 
                className="relative group cursor-pointer border rounded-lg p-3 hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleViewFile(url);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleViewFile(url);
                  }
                }}
              >
                {isImage ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-24 bg-gray-100 rounded-md overflow-hidden">
                      <img
                        src={url}
                        alt={fileInfo.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                          <Eye className="h-5 w-5 text-white" />
                          <span className="text-white text-sm font-medium">Click to View</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs">
                      <p className="truncate font-medium text-gray-800" title={fileInfo.fileName}>
                        {fileInfo.fileName}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                          {fileInfo.fileExtension.toUpperCase()}
                        </Badge>
                        <span className="text-gray-500 text-xs">Image</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-full h-24 bg-gray-100 rounded-md flex items-center justify-center group-hover:bg-gray-200 transition-colors relative">
                      {isPDF ? (
                        <div className="flex flex-col items-center">
                          <FileText className="h-8 w-8 text-red-500" />
                          <span className="text-xs text-red-600 font-medium mt-1">PDF</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <FileText className="h-8 w-8 text-blue-500" />
                          <span className="text-xs text-blue-600 font-medium mt-1">DOC</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                          <Eye className="h-5 w-5 text-gray-700" />
                          <span className="text-gray-700 text-sm font-medium">Click to Open</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs">
                      <p className="truncate font-medium text-gray-800" title={fileInfo.fileName}>
                        {fileInfo.fileName}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${isPDF ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {fileInfo.fileExtension.toUpperCase()}
                        </Badge>
                        <span className="text-gray-500 text-xs">Document</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Quick action buttons */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 bg-white/90 hover:bg-white shadow-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(url, '_blank');
                    }}
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Heart className="h-4 w-4" />
            Medical History
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Medical History - {patient.first_name} {patient.last_name}
          </DialogTitle>
          <DialogDescription>
            View and manage medical history records and attachments for this patient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add New Record Button */}
          {!isAddFormOpen && (
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  // Test with a sample image
                  handleViewFile('https://via.placeholder.com/600x400/0084ff/ffffff.png?text=Test+Image');
                }} 
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Test File Viewer
              </Button>
              <Button onClick={handleStartAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Medical Record
              </Button>
            </div>
          )}

          {/* Add/Edit Form */}
          {isAddFormOpen && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingId ? 'Edit Medical Record' : 'Add New Medical Record'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="condition">Condition *</Label>
                    <Input
                      id="condition"
                      placeholder="e.g., Diabetes Type 2, Hypertension"
                      value={formData.condition}
                      onChange={(e) => handleInputChange('condition', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_diagnosed">Date Diagnosed *</Label>
                    <Input
                      id="date_diagnosed"
                      type="date"
                      value={formData.date_diagnosed}
                      onChange={(e) => handleInputChange('date_diagnosed', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Detailed description of the condition, symptoms, diagnosis process..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="treatment">Treatment</Label>
                  <Textarea
                    id="treatment"
                    placeholder="Current treatment plan, medications, therapies..."
                    value={formData.treatment}
                    onChange={(e) => handleInputChange('treatment', e.target.value)}
                    rows={3}
                  />
                </div>

                {/* File Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Medical Attachments</Label>
                    <Badge variant="outline" className="text-xs">
                      {selectedFiles.length + existingFiles.length}/10 files
                    </Badge>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200">
                    {/* Upload Buttons */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCameraCapture}
                        className="gap-2 bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                        disabled={saving}
                      >
                        <Camera className="h-4 w-4" />
                        Take Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleFileUpload}
                        className="gap-2 bg-white hover:bg-green-50 border-green-200 text-green-700"
                        disabled={saving}
                      >
                        <Image className="h-4 w-4" />
                        Upload Files
                      </Button>
                    </div>
                    
                    <FileUpload
                      onFilesSelected={handleFilesSelected}
                      onFileRemove={handleFileRemove}
                      selectedFiles={selectedFiles}
                      existingFiles={existingFiles}
                      onExistingFileRemove={handleExistingFileRemove}
                      multiple={true}
                      maxFiles={10}
                      disabled={saving}
                    />
                    
                    {/* File Upload Help Text */}
                    <div className="mt-3 text-xs text-gray-500 space-y-1">
                      <p className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Supported: Images (JPG, PNG, GIF, WebP), Documents (PDF, DOC, DOCX)
                      </p>
                      <p>Maximum file size: 10MB • Maximum files: 10</p>
                    </div>
                  </div>
                </div>

                {/* Upload Progress */}
                {uploadProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading: {uploadProgress.fileName}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingId ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      editingId ? 'Update Record' : 'Add Record'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Medical History List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Medical History Records</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading medical histories...</span>
              </div>
            ) : medicalHistories.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-600">No medical history records</p>
                <p className="text-sm text-gray-500 mt-1">
                  Click "Add Medical Record" to create the first record
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {medicalHistories.map((history) => (
                  <Card key={history.history_id} className="relative">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {history.condition}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Calendar className="h-4 w-4" />
                              Diagnosed: {formatDate(history.date_diagnosed)}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-medium text-gray-900">Description:</h4>
                              <p className="text-gray-700 text-sm">{history.description}</p>
                            </div>
                            
                            {history.treatment && (
                              <div>
                                <h4 className="font-medium text-gray-900">Treatment:</h4>
                                <p className="text-gray-700 text-sm">{history.treatment}</p>
                              </div>
                            )}
                          </div>

                          {/* Render attachments */}
                          {renderAttachments(history.attachments)}
                          
                          <div className="text-xs text-gray-500 mt-3">
                            Created: {formatDate(history.created_at)} • 
                            Updated: {formatDate(history.updated_at)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(history)}
                            className="h-8 w-8 p-0"
                            title="Edit record"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(history.history_id)}
                            className="h-8 w-8 p-0 hover:bg-red-100"
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* File Viewing Modal - Moved outside main dialog to avoid z-index issues */}
      {viewingFile && (
        <Dialog open={!!viewingFile} onOpenChange={() => {
          console.log('Closing file viewer'); // Debug log
          setViewingFile(null);
        }}>
          <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-hidden">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-3">
                  {viewingFile.isImage ? (
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Image className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-left">{viewingFile.fileName}</p>
                    <p className="text-sm text-gray-500 font-normal">
                      {viewingFile.isImage ? 'Image File' : 'Document File'}
                    </p>
                  </div>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(viewingFile.url, '_blank')}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto">
              {viewingFile.isImage ? (
                <div className="flex justify-center bg-gray-50 rounded-lg p-4">
                  <img
                    src={viewingFile.url}
                    alt={viewingFile.fileName}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                    style={{ minHeight: '200px' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 space-y-6 bg-gray-50 rounded-lg">
                  <div className="p-4 bg-white rounded-full shadow-md">
                    <FileText className="h-16 w-16 text-gray-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-medium text-gray-800">{viewingFile.fileName}</p>
                    <p className="text-sm text-gray-500 max-w-md">
                      This document type cannot be previewed in the browser. Click the download button to view the file.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => window.open(viewingFile.url, '_blank')}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download & Open
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Copy URL to clipboard
                        navigator.clipboard.writeText(viewingFile.url);
                        toast({
                          title: "Copied!",
                          description: "File URL copied to clipboard",
                        });
                      }}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default MedicalHistoryDialog;
