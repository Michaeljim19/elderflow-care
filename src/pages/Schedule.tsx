import React, { useState, useEffect } from "react";
import { Calendar, Plus, Clock, Edit, Trash2, CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Caregiver, 
  CaregiverShift
} from "@/types";
import { getCaregivers } from "@/services/firebase/caregivers";
import { 
  getCaregiverShifts,
  updateCaregiverShift,
  deleteCaregiverShift,
  addCaregiverShift
} from "@/services/firebase/caregiverShifts";
import { Timestamp } from "firebase/firestore";

const Schedule = () => {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [shifts, setShifts] = useState<CaregiverShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<CaregiverShift | null>(null);
  const [deleteCaregiver, setDeleteCaregiver] = useState<{id: string, name: string} | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [isViewAllDialogOpen, setIsViewAllDialogOpen] = useState(false);
  const [selectedCaregiverShifts, setSelectedCaregiverShifts] = useState<{caregiverId: string, shifts: CaregiverShift[]}>({caregiverId: '', shifts: []});
  const [isAutoRotationDialogOpen, setIsAutoRotationDialogOpen] = useState(false);
  const [autoRotationSettings, setAutoRotationSettings] = useState({
    enabled: true,
    leadTimeHours: 4, // Hours before shift end to trigger rotation
    rotationPattern: 'round-robin' as 'round-robin' | 'random'
  });
  const [editForm, setEditForm] = useState({
    caregiverId: '',
    date: '',
    shiftType: '' as 'Day' | 'Night',
    startTime: '',
    endTime: '',
    notes: ''
  });

  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [caregiversData, shiftsData] = await Promise.all([
        getCaregivers(),
        getCaregiverShifts()
      ]);
      
      setCaregivers(caregiversData);
      setShifts(shiftsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Simple function to get next shift for a caregiver
  const getNextShiftForCaregiver = (caregiverId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get caregiver's future shifts sorted by date
    const futureShifts = shifts
      .filter(shift => 
        shift.caregiver_id === caregiverId && 
        shift.shift_date.toDate() > today
      )
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());
    
    if (futureShifts.length === 0) {
      return null;
    }
    
    const nextShift = futureShifts[0];
    return {
      date: nextShift.shift_date.toDate(),
      shiftType: nextShift.shift_type,
      isUpcoming: true,
      isScheduled: true
    };
  };

  // Function to get current shift for a caregiver
  const getCurrentShiftForCaregiver = (caregiverId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get caregiver's current shifts (today and ongoing)
    const currentShifts = shifts
      .filter(shift => {
        const shiftDate = shift.shift_date.toDate();
        const shiftEnd = shift.end_time instanceof Timestamp ? shift.end_time.toDate() : new Date(shift.end_time);
        return shift.caregiver_id === caregiverId && 
               shiftDate <= today && 
               shiftEnd > today;
      })
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());
    
    if (currentShifts.length === 0) {
      return null;
    }
    
    return currentShifts[0];
  };

  // Helper function to convert Timestamp to Date safely
  const timestampToDate = (timestamp: any): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else {
      return new Date(timestamp);
    }
  };

  // Function to get shift periods (group consecutive shifts of same type)
  const getShiftPeriods = (caregiverId: string) => {
    // Use all shifts for period calculation (we need to see the full timeline to determine periods)
    // but the display logic will filter what's shown
    const caregiverShifts = shifts
      .filter(shift => shift.caregiver_id === caregiverId)
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());

    if (caregiverShifts.length === 0) return { current: null, next: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date(); // Keep current time for precise period detection

    // Find current period
    let currentPeriod = null;
    let nextPeriod = null;

    // Group consecutive shifts of the same type
    const periods: Array<{
      type: 'Day' | 'Night';
      startDate: Date;
      endDate: Date;
      shifts: CaregiverShift[];
      isCurrent: boolean;
      isNext: boolean;
    }> = [];

    let currentGroup: CaregiverShift[] = [];
    let currentType: 'Day' | 'Night' | null = null;

    for (const shift of caregiverShifts) {
      if (shift.shift_type !== currentType) {
        // Save previous group
        if (currentGroup.length > 0 && currentType) {
          const startDate = currentGroup[0].shift_date.toDate();
          // Use the actual end time of the last shift in the period
          const lastShift = currentGroup[currentGroup.length - 1];
          const endTime = timestampToDate(lastShift.end_time);
          
          // For more accurate current period detection, compare with actual timestamps
          const periodStartTime = timestampToDate(currentGroup[0].start_time);
          
          periods.push({
            type: currentType,
            startDate,
            endDate: endTime,
            shifts: [...currentGroup],
            isCurrent: periodStartTime <= now && endTime > now,
            isNext: false
          });
        }
        
        // Start new group
        currentGroup = [shift];
        currentType = shift.shift_type;
      } else {
        // Check if this shift is consecutive (within 1 day of the last shift)
        if (currentGroup.length > 0) {
          const lastShiftDate = currentGroup[currentGroup.length - 1].shift_date.toDate();
          const currentShiftDate = shift.shift_date.toDate();
          const daysDiff = Math.abs((currentShiftDate.getTime() - lastShiftDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 1) {
            currentGroup.push(shift);
          } else {
            // Gap detected, save current group and start new one
            if (currentType) {
              const startDate = currentGroup[0].shift_date.toDate();
              const lastShift = currentGroup[currentGroup.length - 1];
              const endTime = timestampToDate(lastShift.end_time);
              const periodStartTime = timestampToDate(currentGroup[0].start_time);
              
              periods.push({
                type: currentType,
                startDate,
                endDate: endTime,
                shifts: [...currentGroup],
                isCurrent: periodStartTime <= now && endTime > now,
                isNext: false
              });
            }
            
            // Start new group with current shift
            currentGroup = [shift];
          }
        } else {
          currentGroup.push(shift);
        }
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0 && currentType) {
      const startDate = currentGroup[0].shift_date.toDate();
      const lastShift = currentGroup[currentGroup.length - 1];
      const endTime = timestampToDate(lastShift.end_time);
      const periodStartTime = timestampToDate(currentGroup[0].start_time);
      
      periods.push({
        type: currentType,
        startDate,
        endDate: endTime,
        shifts: [...currentGroup],
        isCurrent: periodStartTime <= now && endTime > now,
        isNext: false
      });
    }

    // Sort periods by start date
    periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // Find current and next periods with improved logic
    const currentPeriodIndex = periods.findIndex(p => p.isCurrent);
    
    if (currentPeriodIndex >= 0) {
      currentPeriod = periods[currentPeriodIndex];
      // Look for next period after current
      const nextPeriodIndex = periods.findIndex((p, index) => 
        index > currentPeriodIndex && p.startDate > currentPeriod!.endDate
      );
      if (nextPeriodIndex >= 0) {
        nextPeriod = periods[nextPeriodIndex];
        nextPeriod.isNext = true;
      }
    } else {
      // If no current period, find the next upcoming one
      const upcomingPeriods = periods.filter(p => p.startDate > now);
      if (upcomingPeriods.length > 0) {
        nextPeriod = upcomingPeriods[0];
        nextPeriod.isNext = true;
      }
      
      // Also check if there's a period that should be current but wasn't detected
      // (in case of edge cases with time comparison)
      const potentialCurrent = periods.find(p => {
        const dayOnly = new Date(p.startDate);
        dayOnly.setHours(0, 0, 0, 0);
        const endDayOnly = new Date(p.endDate);
        endDayOnly.setHours(23, 59, 59, 999);
        return dayOnly <= today && endDayOnly >= today;
      });
      
      if (potentialCurrent && !currentPeriod) {
        currentPeriod = potentialCurrent;
        currentPeriod.isCurrent = true;
        
        // Re-find next period
        const currentIndex = periods.indexOf(currentPeriod);
        const nextIndex = periods.findIndex((p, index) => 
          index > currentIndex && p.startDate > currentPeriod!.endDate
        );
        if (nextIndex >= 0) {
          nextPeriod = periods[nextIndex];
          nextPeriod.isNext = true;
        }
      }
    }

    return { current: currentPeriod, next: nextPeriod, allPeriods: periods };
  };

  // Function to group shifts by caregiver
  // Helper function to find the next caregiver who will take over after a period ends
  const findNextCaregiverForDate = (date: Date, excludeCaregiverId: string) => {
    // Look for any caregiver who has a next period starting around this date
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    
    for (const caregiver of caregivers) {
      if (caregiver.caregiver_id === excludeCaregiverId) continue;
      
      const { next } = getShiftPeriods(caregiver.caregiver_id);
      if (next && 
          next.startDate.getTime() >= date.getTime() && 
          next.startDate.getTime() <= nextDay.getTime()) {
        return {
          caregiverId: caregiver.caregiver_id,
          shiftType: next.type,
          startDate: next.startDate
        };
      }
    }
    
    return null;
  };

  // Central function to filter only relevant shifts (current and next periods + recent past)
  const getRelevantShifts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return shifts.filter(shift => {
      const shiftDate = shift.shift_date.toDate();
      const { current, next } = getShiftPeriods(shift.caregiver_id);
      
      // Always show shift if it's part of current period
      if (current && shiftDate >= current.startDate && shiftDate <= current.endDate) {
        return true;
      }
      
      // Always show shift if it's part of next period
      if (next && shiftDate >= next.startDate && shiftDate <= next.endDate) {
        return true;
      }
      
      // Show recent past shifts (within 3 days) for context
      const daysDiff = Math.floor((today.getTime() - shiftDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff <= 3) {
        return true;
      }
      
      // Hide all other shifts (old past periods, future periods beyond next)
      return false;
    });
  };

  const getGroupedShifts = () => {
    const grouped = new Map<string, CaregiverShift[]>();
    
    // Use only relevant shifts instead of all shifts
    const relevantShifts = getRelevantShifts();
    
    // Sort shifts by date first
    const sortedShifts = [...relevantShifts].sort((a, b) => 
      a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime()
    );
    
    sortedShifts.forEach(shift => {
      const caregiverId = shift.caregiver_id;
      if (!grouped.has(caregiverId)) {
        grouped.set(caregiverId, []);
      }
      grouped.get(caregiverId)!.push(shift);
    });
    
    return Array.from(grouped.entries()).map(([caregiverId, caregiverShifts]) => ({
      caregiverId,
      shifts: caregiverShifts
    }));
  };

  // Auto-rotation functions
  const isShiftAboutToEnd = (shift: CaregiverShift) => {
    if (!autoRotationSettings.enabled) return false;
    
    const now = new Date();
    const shiftEndTime = shift.end_time instanceof Timestamp ? shift.end_time.toDate() : new Date(shift.end_time);
    const leadTimeMs = autoRotationSettings.leadTimeHours * 60 * 60 * 1000;
    const rotationTriggerTime = new Date(shiftEndTime.getTime() - leadTimeMs);
    
    return now >= rotationTriggerTime && now < shiftEndTime;
  };

  const isShiftPeriodAboutToEnd = (caregiverId: string) => {
    const { current } = getShiftPeriods(caregiverId);
    if (!current || !autoRotationSettings.enabled) return false;
    
    const now = new Date();
    const periodEndTime = current.endDate;
    
    // Check if the period ends within the next 24 hours
    const hoursUntilEnd = (periodEndTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const leadTimeHours = autoRotationSettings.leadTimeHours || 24; // Default to 24 hours if not set
    
    return hoursUntilEnd > 0 && hoursUntilEnd <= leadTimeHours;
  };

  // Helper function to check if a period is currently active
  const isPeriodActive = (period: any) => {
    const now = new Date();
    return period.startDate <= now && period.endDate > now;
  };

  // Helper function to get the most accurate current period
  const getCurrentActivePeriod = (caregiverId: string) => {
    const { current, allPeriods } = getShiftPeriods(caregiverId);
    
    // Double-check if the detected current period is actually active
    if (current && isPeriodActive(current)) {
      return current;
    }
    
    // If not, search through all periods for an active one
    if (allPeriods) {
      const activePeriod = allPeriods.find(period => isPeriodActive(period));
      return activePeriod || null;
    }
    
    return null;
  };

  const getNextCaregiverForRotation = (currentCaregiverId: string) => {
    const availableCaregivers = caregivers.filter(c => c.caregiver_id !== currentCaregiverId);
    
    if (availableCaregivers.length === 0) return null;
    
    if (autoRotationSettings.rotationPattern === 'round-robin') {
      // Find the next caregiver in alphabetical order
      const sortedCaregivers = availableCaregivers.sort((a, b) => 
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      return sortedCaregivers[0];
    } else {
      // Random selection
      const randomIndex = Math.floor(Math.random() * availableCaregivers.length);
      return availableCaregivers[randomIndex];
    }
  };

  const generateInitialShiftPeriod = async (caregiverId: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
    if (!caregiver) return null;

    // Start from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Default to Day shift for initial period
    const shiftType = 'Day';
    const shiftDuration = 4; // 4 days per period
    
    const newShifts = [];
    
    for (let i = 0; i < shiftDuration; i++) {
      const shiftDate = new Date(today);
      shiftDate.setDate(today.getDate() + i);
      
      // Set shift times based on type
      const startTime = new Date(shiftDate);
      const endTime = new Date(shiftDate);
      
      if (shiftType === 'Day') {
        startTime.setHours(7, 0, 0, 0); // 7 AM
        endTime.setHours(19, 0, 0, 0);  // 7 PM
      } else {
        startTime.setHours(19, 0, 0, 0); // 7 PM
        endTime.setDate(endTime.getDate() + 1); // Next day
        endTime.setHours(7, 0, 0, 0);   // 7 AM next day
      }

      const newShift = {
        caregiver_id: caregiverId,
        shift_date: Timestamp.fromDate(shiftDate),
        shift_type: shiftType,
        start_time: Timestamp.fromDate(startTime),
        end_time: Timestamp.fromDate(endTime),
        notes: `Auto-generated initial ${shiftType} shift period (${i + 1}/4)`,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };

      newShifts.push(newShift);
    }

    try {
      // Add all shifts in the period
      for (const shift of newShifts) {
        await addCaregiverShift(shift);
      }
      
      return {
        caregiverId: caregiverId,
        shiftType: shiftType,
        startDate: today,
        endDate: new Date(today.getTime() + (shiftDuration * 24 * 60 * 60 * 1000)),
        shiftsCount: newShifts.length
      };
    } catch (error) {
      console.error('Error creating initial shift period:', error);
      return null;
    }
  };

  const generateNextShiftPeriod = async (currentCaregiverId: string) => {
    const { current } = getShiftPeriods(currentCaregiverId);
    if (!current) return null;

    const nextCaregiver = getNextCaregiverForRotation(currentCaregiverId);
    if (!nextCaregiver) return null;

    // Generate 4-day shift period starting after current period ends
    const nextPeriodStart = new Date(current.endDate);
    const nextShiftType = current.type === 'Day' ? 'Night' : 'Day';
    const shiftDuration = 4; // 4 days per period
    
    const newShifts = [];
    
    for (let i = 0; i < shiftDuration; i++) {
      const shiftDate = new Date(nextPeriodStart);
      shiftDate.setDate(nextPeriodStart.getDate() + i);
      
      // Set shift times based on type
      const startTime = new Date(shiftDate);
      const endTime = new Date(shiftDate);
      
      if (nextShiftType === 'Day') {
        startTime.setHours(7, 0, 0, 0); // 7 AM
        endTime.setHours(19, 0, 0, 0);  // 7 PM
      } else {
        startTime.setHours(19, 0, 0, 0); // 7 PM
        endTime.setDate(endTime.getDate() + 1); // Next day
        endTime.setHours(7, 0, 0, 0);   // 7 AM next day
      }

      const newShift = {
        caregiver_id: nextCaregiver.caregiver_id,
        shift_date: Timestamp.fromDate(shiftDate),
        shift_type: nextShiftType,
        start_time: Timestamp.fromDate(startTime),
        end_time: Timestamp.fromDate(endTime),
        notes: `Auto-generated ${nextShiftType} shift period (${i + 1}/4) - rotation from ${getCaregiverName(currentCaregiverId)}`,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };

      newShifts.push(newShift);
    }

    try {
      // Add all shifts in the period
      for (const shift of newShifts) {
        await addCaregiverShift(shift);
      }
      
      return {
        caregiverId: nextCaregiver.caregiver_id,
        shiftType: nextShiftType,
        startDate: nextPeriodStart,
        endDate: new Date(nextPeriodStart.getTime() + (shiftDuration * 24 * 60 * 60 * 1000)),
        shiftsCount: newShifts.length
      };
    } catch (error) {
      console.error('Error creating auto-rotation shift period:', error);
      return null;
    }
  };

  const checkAndProcessAutoRotations = async () => {
    if (!autoRotationSettings.enabled) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let hasGeneratedNewShifts = false;

    // Check each caregiver's current shift period
    for (const caregiver of caregivers) {
      const { current, next } = getShiftPeriods(caregiver.caregiver_id);
      
      // Generate next period if current exists but no next period, or if current period is ending within 1 day
      if (current && !next) {
        const timeDiffMs = current.endDate.getTime() - today.getTime();
        const timeDiffDays = Math.ceil(timeDiffMs / (1000 * 60 * 60 * 24));
        
        // Generate next period if current period ends within 1 day or has already ended
        if (timeDiffDays <= 1) {
          const newPeriod = await generateNextShiftPeriod(caregiver.caregiver_id);
          if (newPeriod) {
            hasGeneratedNewShifts = true;
            toast({
              title: "Auto-Rotation Activated",
              description: `Next ${newPeriod.shiftType} shift period (${newPeriod.shiftsCount} days) assigned to ${getCaregiverName(newPeriod.caregiverId)}`,
              duration: 5000,
            });
          }
        }
      }
      
      // Also check if we need to generate initial shifts if no current period exists
      if (!current && !next) {
        const initialPeriod = await generateInitialShiftPeriod(caregiver.caregiver_id);
        if (initialPeriod) {
          hasGeneratedNewShifts = true;
          toast({
            title: "Initial Shift Period Created",
            description: `${initialPeriod.shiftType} shift period (${initialPeriod.shiftsCount} days) assigned to ${getCaregiverName(initialPeriod.caregiverId)}`,
            duration: 5000,
          });
        }
      }
    }

    // Reload data if new shifts were generated
    if (hasGeneratedNewShifts) {
      await loadData();
    }
  };

  // Check for auto-rotations periodically and on mount
  useEffect(() => {
    // Run once on mount
    checkAndProcessAutoRotations();
    
    if (autoRotationSettings.enabled) {
      // Then check every 30 seconds for more responsive automation
      const interval = setInterval(checkAndProcessAutoRotations, 30000);
      return () => clearInterval(interval);
    }
  }, [shifts, autoRotationSettings.enabled, caregivers]);

  // Helper functions
  const formatDate = (date: Date | Timestamp) => {
    const dateObj = date instanceof Timestamp ? date.toDate() : date;
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time: string | Timestamp) => {
    if (typeof time === 'string') {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (time instanceof Timestamp) {
      return time.toDate().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return '';
  };

  const formatDateRange = (shifts: CaregiverShift[]) => {
    if (shifts.length === 0) return '';
    if (shifts.length === 1) {
      const date = shifts[0].shift_date.toDate();
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const dates = shifts.map(shift => shift.shift_date.toDate()).sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    // If all shifts are on the same day
    if (firstDate.toDateString() === lastDate.toDateString()) {
      return firstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Format as "Sun-Wed" if within same week, or "Dec 1-5" if different weeks
    const firstWeekday = firstDate.toLocaleDateString('en-US', { weekday: 'short' });
    const lastWeekday = lastDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Check if they're in the same month
    if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
      return `${firstWeekday} ${firstDate.getDate()}-${lastWeekday} ${lastDate.getDate()}`;
    } else {
      return `${firstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - ${lastDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    }
  };

  const getCaregiverName = (caregiverId: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
    return caregiver ? `${caregiver.first_name} ${caregiver.last_name}` : 'Unknown';
  };

  // Calendar helper functions
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      dates.push(day);
    }
    return dates;
  };

  const getRelevantShiftsForCalendar = () => {
    // Use the same filtering logic as table view
    return getRelevantShifts();
  };

  const getShiftsForDate = (date: Date) => {
    const relevantShifts = getRelevantShiftsForCalendar();
    return relevantShifts.filter(shift => {
      const shiftDate = shift.shift_date.toDate();
      return shiftDate.toDateString() === date.toDateString();
    });
  };

  const getMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // Shift management functions
  const handleEditShift = (shift: CaregiverShift) => {
    setEditingShift(shift);
    setEditForm({
      caregiverId: shift.caregiver_id,
      date: shift.shift_date.toDate().toISOString().split('T')[0],
      shiftType: shift.shift_type,
      startTime: shift.start_time instanceof Timestamp 
        ? shift.start_time.toDate().toTimeString().split(' ')[0].substring(0, 5)
        : shift.start_time,
      endTime: shift.end_time instanceof Timestamp 
        ? shift.end_time.toDate().toTimeString().split(' ')[0].substring(0, 5)
        : shift.end_time,
      notes: shift.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!editingShift) return;

    try {
      const shiftDate = new Date(editForm.date);
      const startTime = new Date(`${editForm.date}T${editForm.startTime}`);
      const endTime = new Date(`${editForm.date}T${editForm.endTime}`);
      
      if (editForm.shiftType === 'Night' && editForm.endTime < editForm.startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      const updatedShift = {
        ...editingShift,
        caregiver_id: editForm.caregiverId,
        shift_date: Timestamp.fromDate(shiftDate),
        shift_type: editForm.shiftType,
        start_time: Timestamp.fromDate(startTime),
        end_time: Timestamp.fromDate(endTime),
        notes: editForm.notes,
        updated_at: Timestamp.now()
      };

      await updateCaregiverShift(editingShift.shift_id, updatedShift);
      await loadData();
      
      // Check if we need to generate new shifts after update
      if (autoRotationSettings.enabled) {
        setTimeout(() => {
          checkAndProcessAutoRotations();
        }, 1000); // Wait for data to be updated
      }
      
      setIsEditDialogOpen(false);
      setEditingShift(null);

      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
    } catch (error) {
      console.error('Error updating shift:', error);
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      await deleteCaregiverShift(shiftId);
      await loadData();
      
      // Check if we need to regenerate shifts after deletion
      if (autoRotationSettings.enabled) {
        setTimeout(() => {
          checkAndProcessAutoRotations();
        }, 1000); // Wait for data to be updated
      }
      
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive",
      });
    }
  };

  const handleViewAllShifts = (caregiverId: string, shifts: CaregiverShift[]) => {
    setSelectedCaregiverShifts({ caregiverId, shifts });
    setIsViewAllDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Clock className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading caregiver shifts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caregiver Schedule</h1>
          <p className="text-muted-foreground">Manage caregiver shifts and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              setLoading(true);
              await loadData();
              await checkAndProcessAutoRotations();
              setLoading(false);
              toast({
                title: "Refreshed",
                description: "Schedule data has been refreshed",
              });
            }}
            disabled={loading}
          >
            <Clock className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setIsAutoRotationDialogOpen(true)}>
            <Clock className="h-4 w-4 mr-2" />
            Auto-Rotation Settings
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Shift
          </Button>
        </div>
      </div>

      {/* View Toggle and Content */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'table' | 'calendar')} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="table" className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="text-sm font-medium">Active Caregivers</div>
                </div>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {getGroupedShifts().length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="text-sm font-medium">Total Shifts</div>
                </div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {getRelevantShifts().length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <div className="text-sm font-medium">Periods Ending</div>
                </div>
                <div className="text-2xl font-bold text-orange-600 mt-1">
                  {caregivers.filter(c => {
                    const { current } = getShiftPeriods(c.caregiver_id);
                    return current && isShiftPeriodAboutToEnd(c.caregiver_id);
                  }).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div className="text-sm font-medium">Auto-Rotation</div>
                </div>
                <div className="text-sm font-bold mt-1">
                  <Badge variant={autoRotationSettings.enabled ? "default" : "secondary"}>
                    {autoRotationSettings.enabled ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Shifts Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Caregiver Schedule Overview
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Current and next periods with recent history • Auto-rotation: {autoRotationSettings.enabled ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Showing {getRelevantShifts().length} relevant shifts
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {getRelevantShifts().length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Active Shifts</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    No current or next period shifts found. Enable auto-rotation to generate periods automatically, or add shifts manually.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Shift
                    </Button>
                    <Button variant="outline" onClick={() => setIsAutoRotationDialogOpen(true)}>
                      <Clock className="h-4 w-4 mr-2" />
                      Configure Auto-Rotation
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Table Header */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2">
                          <TableHead className="font-semibold">Caregiver</TableHead>
                          <TableHead className="font-semibold">Current Period</TableHead>
                          <TableHead className="font-semibold">Next Period</TableHead>
                          <TableHead className="font-semibold">Recent Shifts</TableHead>
                          <TableHead className="font-semibold text-center">Total</TableHead>
                          <TableHead className="font-semibold text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getGroupedShifts().map(({ caregiverId, shifts: caregiverShifts }) => {
                          const totalShifts = caregiverShifts.length;
                          const { current, next } = getShiftPeriods(caregiverId);
                          const isCurrentPeriodEnding = current && isShiftPeriodAboutToEnd(caregiverId);
                          const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
                          
                          return (
                            <TableRow key={caregiverId} className="hover:bg-gray-50/50">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                    {caregiver?.first_name?.charAt(0)}{caregiver?.last_name?.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-semibold">{getCaregiverName(caregiverId)}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {caregiver?.shift_type} Shift • Active
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {current ? (
                                  (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const isPastPeriod = current.endDate < today;
                                    
                                    return (
                                      <div className={`flex flex-col p-3 rounded-lg border-l-4 ${
                                        isPastPeriod 
                                          ? 'bg-gray-50 border-gray-300 opacity-75' 
                                          : isCurrentPeriodEnding 
                                            ? 'bg-orange-50 border-orange-400 shadow-sm' 
                                            : 'bg-blue-50 border-blue-400 shadow-sm'
                                      }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge 
                                            variant={isPastPeriod ? 'outline' : current.type === 'Day' ? 'default' : 'secondary'} 
                                            className={`text-xs ${isPastPeriod ? 'border-gray-300 text-gray-500' : ''}`}
                                          >
                                            {current.type} Shift
                                          </Badge>
                                          {isPastPeriod && (
                                            <Badge variant="outline" className="text-xs border-gray-300 text-gray-500">
                                              Completed
                                            </Badge>
                                          )}
                                          {!isPastPeriod && isCurrentPeriodEnding && (
                                            <Badge variant="destructive" className="text-xs animate-pulse">
                                              Ending Soon
                                            </Badge>
                                          )}
                                        </div>
                                        <div className={`font-medium text-sm ${isPastPeriod ? 'text-gray-500' : ''}`}>
                                          {current.startDate.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric' 
                                          })} - {current.endDate.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric' 
                                          })}
                                        </div>
                                        <div className={`text-xs ${isPastPeriod ? 'text-gray-400' : 'text-muted-foreground'}`}>
                                          {current.shifts.length} day{current.shifts.length !== 1 ? 's' : ''} • {
                                            Math.ceil((current.endDate.getTime() - current.startDate.getTime()) / (1000 * 60 * 60 * 24))
                                          } total days
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="text-center p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <span className="text-xs text-muted-foreground">No current period</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {next ? (
                                  (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const isPastPeriod = next.endDate < today;
                                    
                                    return (
                                      <div className={`flex flex-col p-3 rounded-lg border-l-4 ${
                                        isPastPeriod 
                                          ? 'bg-gray-50 border-gray-300 opacity-75' 
                                          : 'bg-green-50 border-green-400 shadow-sm'
                                      }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge 
                                            variant={isPastPeriod ? 'outline' : next.type === 'Day' ? 'default' : 'secondary'} 
                                            className={`text-xs ${isPastPeriod ? 'border-gray-300 text-gray-500' : ''}`}
                                          >
                                            {next.type} Shift
                                          </Badge>
                                          <Badge 
                                            variant="outline" 
                                            className={`text-xs ${
                                              isPastPeriod 
                                                ? 'border-gray-300 text-gray-500' 
                                                : 'border-green-300 text-green-700'
                                            }`}
                                          >
                                            {isPastPeriod ? 'Completed' : 'Scheduled'}
                                          </Badge>
                                        </div>
                                        <div className={`font-medium text-sm ${isPastPeriod ? 'text-gray-500' : ''}`}>
                                          {next.startDate.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric' 
                                          })} - {next.endDate.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric' 
                                          })}
                                        </div>
                                        <div className={`text-xs ${isPastPeriod ? 'text-gray-400' : 'text-muted-foreground'}`}>
                                          {next.shifts.length} day{next.shifts.length !== 1 ? 's' : ''} • Starts in {
                                            Math.ceil((next.startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                          } day{Math.ceil((next.startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) !== 1 ? 's' : ''}
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="text-center p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    {autoRotationSettings.enabled ? (
                                      <div className="space-y-1">
                                        <Badge variant="outline" className="text-xs">
                                          Auto-Generate
                                        </Badge>
                                        <div className="text-xs text-muted-foreground">
                                          Will be created automatically
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">No next period</span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2 max-w-sm">
                                  {caregiverShifts.slice(0, 3).map((shift, index) => {
                                    const isAboutToEnd = isShiftAboutToEnd(shift);
                                    const shiftDate = shift.shift_date.toDate();
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const isPastShift = shiftDate < today;
                                    
                                    return (
                                      <div key={shift.shift_id} className={`flex items-center justify-between p-2 rounded-md border text-sm ${
                                        isPastShift 
                                          ? 'bg-gray-50 border-gray-200 opacity-75' 
                                          : isAboutToEnd 
                                            ? 'bg-orange-50 border-orange-200' 
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                      }`}>
                                        <div className="flex items-center gap-2">
                                          <Badge 
                                            variant={isPastShift ? 'outline' : shift.shift_type === 'Day' ? 'default' : 'secondary'} 
                                            className={`text-xs ${isPastShift ? 'border-gray-300 text-gray-500' : ''}`}
                                          >
                                            {shift.shift_type}
                                          </Badge>
                                          <span className={`text-xs ${isPastShift ? 'text-gray-500' : 'text-muted-foreground'}`}>
                                            {shift.shift_date.toDate().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className={`text-xs ${isPastShift ? 'text-gray-400' : 'text-muted-foreground'}`}>
                                            {formatTime(shift.start_time)}-{formatTime(shift.end_time)}
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 hover:bg-gray-200"
                                            onClick={() => handleEditShift(shift)}
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {totalShifts > 3 && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full text-xs py-1 h-8"
                                      onClick={() => handleViewAllShifts(caregiverId, caregiverShifts)}
                                    >
                                      +{totalShifts - 3} more shifts
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <Badge variant="outline" className="text-sm font-semibold">
                                    {totalShifts}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    shift{totalShifts !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewAllShifts(caregiverId, caregiverShifts)}
                                    className="text-xs"
                                  >
                                    View All
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Add shift for this caregiver"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile View */}
                  <div className="lg:hidden space-y-4">
                    {getGroupedShifts().map(({ caregiverId, shifts: caregiverShifts }) => {
                      const totalShifts = caregiverShifts.length;
                      const { current, next } = getShiftPeriods(caregiverId);
                      const isCurrentPeriodEnding = current && isShiftPeriodAboutToEnd(caregiverId);
                      const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
                      
                      return (
                        <Card key={caregiverId} className="overflow-hidden">
                          <CardContent className="p-4">
                            {/* Caregiver Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                  {caregiver?.first_name?.charAt(0)}{caregiver?.last_name?.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-semibold text-lg">{getCaregiverName(caregiverId)}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {caregiver?.shift_type} Shift • {totalShifts} total shifts
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewAllShifts(caregiverId, caregiverShifts)}
                              >
                                View All
                              </Button>
                            </div>

                            {/* Periods */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">Current Period</h4>
                                {current ? (
                                  <div className={`p-3 rounded-lg border-l-4 ${
                                    isCurrentPeriodEnding 
                                      ? 'bg-orange-50 border-orange-400' 
                                      : 'bg-blue-50 border-blue-400'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant={current.type === 'Day' ? 'default' : 'secondary'} className="text-xs">
                                        {current.type}
                                      </Badge>
                                      {isCurrentPeriodEnding && (
                                        <Badge variant="destructive" className="text-xs">
                                          Ending Soon
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm font-medium">
                                      {current.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                                      {current.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                                    <span className="text-sm text-muted-foreground">No current period</span>
                                  </div>
                                )}
                              </div>

                              <div>
                                <h4 className="text-sm font-medium mb-2">Next Period</h4>
                                {next ? (
                                  <div className="p-3 rounded-lg border-l-4 bg-green-50 border-green-400">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant={next.type === 'Day' ? 'default' : 'secondary'} className="text-xs">
                                        {next.type}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                        Scheduled
                                      </Badge>
                                    </div>
                                    <div className="text-sm font-medium">
                                      {next.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                                      {next.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                                    {autoRotationSettings.enabled ? (
                                      <Badge variant="outline" className="text-xs">
                                        Auto-Generate
                                      </Badge>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">No next period</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Recent Shifts */}
                            <div>
                              <h4 className="text-sm font-medium mb-2">Recent Shifts</h4>
                              <div className="space-y-2">
                                {caregiverShifts.slice(0, 2).map((shift) => (
                                  <div key={shift.shift_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={shift.shift_type === 'Day' ? 'default' : 'secondary'} className="text-xs">
                                        {shift.shift_type}
                                      </Badge>
                                      <span className="text-sm">{formatDate(shift.shift_date)}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {formatTime(shift.start_time)}-{formatTime(shift.end_time)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          {/* Calendar View */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Schedule Calendar
                </CardTitle>
                <div className="flex items-center gap-3">
                  {/* Month/Week Toggle */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-3 text-xs"
                      onClick={() => {/* Week view logic */}}
                    >
                      Week
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-3 text-xs bg-white shadow-sm"
                      onClick={() => {/* Month view logic */}}
                    >
                      Month
                    </Button>
                  </div>
                  
                  {/* Navigation Controls */}
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigateWeek('prev')}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {/* Date Display & Picker */}
                    <div className="flex items-center gap-2 mx-2">
                      <span className="text-lg font-semibold min-w-[200px] text-center">
                        {getMonthYear(currentDate)}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentDate(new Date())}
                        className="text-xs h-8"
                      >
                        Today
                      </Button>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigateWeek('next')}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Quick Jump */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={currentDate.toISOString().split('T')[0]}
                      onChange={(e) => setCurrentDate(new Date(e.target.value))}
                      className="w-40 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              
              {/* Next Shift Legend */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-muted-foreground">Period Indicators:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-xs">Current Period</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs">Next Period</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
                      <span className="text-xs">Period Ending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-purple-300 relative">
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-white rounded-full border border-purple-400"></div>
                      </div>
                      <span className="text-xs">Caregiver Handover</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <span className="text-xs">Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400 opacity-60"></div>
                      <span className="text-xs">Past/Completed</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={autoRotationSettings.enabled ? "default" : "secondary"} className="text-xs">
                      Auto-Rotation {autoRotationSettings.enabled ? 'ON' : 'OFF'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Today: {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {/* Calendar Filter Summary */}
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Showing:</span> Current and next periods, plus recent past shifts (3 days). 
                      Past shifts appear in grey. Older periods are hidden.
                    </div>
                    {/* Quick transition preview */}
                    <div className="text-xs text-muted-foreground">
                      {getWeekDates(currentDate).some(date => {
                        return caregivers.some(caregiver => {
                          const { current } = getShiftPeriods(caregiver.caregiver_id);
                          return current && date.getTime() === current.endDate.getTime() && 
                                 findNextCaregiverForDate(date, caregiver.caregiver_id);
                        });
                      }) && (
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                          Handovers this week
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Enhanced Calendar Header */}
              <div className="grid grid-cols-8 gap-1 mb-6">
                <div className="p-3">
                  <div className="text-sm font-medium text-muted-foreground">Time Slot</div>
                </div>
                {getWeekDates(currentDate).map((date, index) => {
                  // Get all period information for this date across all caregivers
                  const allPeriodInfo = caregivers.map(caregiver => {
                    const caregiverId = caregiver.caregiver_id;
                    const { current, next } = getShiftPeriods(caregiverId);
                    const isCurrentPeriodEnding = current && isShiftPeriodAboutToEnd(caregiverId);
                    
                    return {
                      caregiverId,
                      caregiver,
                      current,
                      next,
                      isCurrentPeriodEnding
                    };
                  });

                  // Find what's happening on this specific date
                  const periodIndicators = [];
                  
                  allPeriodInfo.forEach(({ caregiverId, caregiver, current, next, isCurrentPeriodEnding }) => {
                    let indicatorType = null;
                    let tooltipText = '';
                    let isTransition = false;
                    
                    // Check if date falls in current period
                    if (current && date >= current.startDate && date <= current.endDate) {
                      indicatorType = isCurrentPeriodEnding ? 'ending' : 'current';
                      tooltipText = `${getCaregiverName(caregiverId)} - Current ${current.type} period ${isCurrentPeriodEnding ? '(ending soon)' : ''}`;
                      
                      // Check if this is the last day of current period
                      if (date.getTime() === current.endDate.getTime()) {
                        // Look for who takes over next
                        const nextCaregiver = findNextCaregiverForDate(date, caregiverId);
                        
                        if (nextCaregiver) {
                          isTransition = true;
                          tooltipText += ` → Next: ${getCaregiverName(nextCaregiver.caregiverId)} ${nextCaregiver.shiftType}`;
                        }
                      }
                    }
                    // Check if date falls in next period
                    else if (next && date >= next.startDate && date <= next.endDate) {
                      indicatorType = 'next';
                      tooltipText = `${getCaregiverName(caregiverId)} - Next ${next.type} period`;
                      
                      // Check if this is the first day of next period
                      if (date.getTime() === next.startDate.getTime()) {
                        // Look for who this caregiver is taking over from
                        const previousDay = new Date(date);
                        previousDay.setDate(date.getDate() - 1);
                        
                        const previousCaregiverInfo = allPeriodInfo.find(info => 
                          info.current && 
                          info.caregiverId !== caregiverId &&
                          info.current.endDate.getTime() === previousDay.getTime()
                        );
                        
                        if (previousCaregiverInfo) {
                          isTransition = true;
                          tooltipText = `Transition: ${getCaregiverName(caregiverId)} takes over from ${getCaregiverName(previousCaregiverInfo.caregiverId)}`;
                        }
                      }
                    }
                    
                    if (indicatorType) {
                      periodIndicators.push({
                        caregiver,
                        indicatorType,
                        tooltipText,
                        isTransition
                      });
                    }
                  });

                  const shiftsOnDate = getShiftsForDate(date);
                  const isToday = date.toDateString() === new Date().toDateString();

                  return (
                    <div key={index} className={`relative p-3 rounded-lg border-2 transition-all ${
                      isToday 
                        ? 'bg-yellow-50 border-yellow-300 shadow-md' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}>
                      {/* Day header */}
                      <div className="text-center">
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-2xl font-bold mb-2 ${isToday ? 'text-yellow-700' : ''}`}>
                          {date.getDate()}
                        </div>
                        {isToday && (
                          <div className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-1 rounded-full mb-2">
                            Today
                          </div>
                        )}
                      </div>
                      
                      {/* Shift summary */}
                      {shiftsOnDate.length > 0 && (
                        <div className="text-center mb-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {shiftsOnDate.length} shift{shiftsOnDate.length !== 1 ? 's' : ''}
                          </div>
                          <div className="flex justify-center gap-1 mt-1">
                            {shiftsOnDate.filter(s => s.shift_type === 'Day').length > 0 && (
                              <div className="w-3 h-3 bg-blue-500 rounded" title="Day shifts"></div>
                            )}
                            {shiftsOnDate.filter(s => s.shift_type === 'Night').length > 0 && (
                              <div className="w-3 h-3 bg-purple-500 rounded" title="Night shifts"></div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Transition indicator */}
                      {periodIndicators.some(p => p.isTransition) && (
                        <div className="text-center mb-2">
                          <div className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                            Handover Day
                          </div>
                        </div>
                      )}
                      
                      {/* Period indicators */}
                      {periodIndicators.length > 0 && (
                        <div className="flex justify-center gap-1 flex-wrap">
                          {periodIndicators.map(({ indicatorType, tooltipText, isTransition }, idx) => {
                            let indicatorClass = '';
                            
                            if (isTransition) {
                              indicatorClass = 'bg-purple-500 border-2 border-purple-300 animate-pulse shadow-lg';
                            } else {
                              switch (indicatorType) {
                                case 'current':
                                  indicatorClass = 'bg-blue-500 shadow-md';
                                  break;
                                case 'next':
                                  indicatorClass = 'bg-green-500 shadow-md';
                                  break;
                                case 'ending':
                                  indicatorClass = 'bg-orange-500 animate-pulse shadow-lg';
                                  break;
                              }
                            }
                            
                            return (
                              <div
                                key={idx}
                                className={`w-3 h-3 rounded-full ${indicatorClass} relative`}
                                title={tooltipText}
                              >
                                {/* Add a small arrow for transitions */}
                                {isTransition && (
                                  <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-white rounded-full border border-purple-400"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-1 gap-1">
                {/* Time slots */}
                {['Day (7AM-7PM)', 'Night (7PM-7AM)'].map((slot, slotIndex) => (
                  <div key={slot} className="grid grid-cols-8 gap-1">
                    {/* Time label */}
                    <div className="text-xs text-muted-foreground p-2 border-r">
                      <div className="font-medium">{slot}</div>
                    </div>
                    
                    {/* Day columns */}
                    {getWeekDates(currentDate).map((date, dayIndex) => {
                      const dayShifts = getShiftsForDate(date);
                      const slotShifts = dayShifts.filter(shift => 
                        (slotIndex === 0 && shift.shift_type === 'Day') ||
                        (slotIndex === 1 && shift.shift_type === 'Night')
                      );

                      return (
                        <div key={dayIndex} className="min-h-[80px] p-1 border border-gray-100">
                          {slotShifts.length === 0 ? (
                            <div className="text-xs text-gray-400 p-2 text-center">
                              No active shifts
                            </div>
                          ) : (
                            slotShifts.map((shift, shiftIndex) => {
                              const isAboutToEnd = isShiftAboutToEnd(shift);
                              const { current, next } = getShiftPeriods(shift.caregiver_id);
                              const isPeriodEnding = current && isShiftPeriodAboutToEnd(shift.caregiver_id);
                              const shiftDate = shift.shift_date.toDate();
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const isToday = shiftDate.toDateString() === today.toDateString();
                              const isPastShift = shiftDate < today;
                              
                              // Determine if this shift is part of current or next period
                              let periodType = 'current'; // Default to current since we're filtering
                              let periodLabel = 'Current';
                              if (current && shiftDate >= current.startDate && shiftDate <= current.endDate) {
                                periodType = 'current';
                                periodLabel = 'Current';
                              } else if (next && shiftDate >= next.startDate && shiftDate <= next.endDate) {
                                periodType = 'next';
                                periodLabel = 'Next';
                              }
                              
                              // Override period type if shift is in the past
                              if (isPastShift) {
                                periodType = 'past';
                                periodLabel = 'Past';
                              }
                            
                            return (
                              <div
                                key={shiftIndex}
                                className={`group relative text-xs p-3 rounded-lg mb-2 cursor-pointer transition-all duration-200 border hover:shadow-md ${
                                  isPastShift 
                                    ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100' 
                                    : shift.shift_type === 'Day' 
                                      ? 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900 border-blue-200 hover:from-blue-100 hover:to-blue-200' 
                                      : 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-900 border-purple-200 hover:from-purple-100 hover:to-purple-200'
                                } ${
                                  isToday ? 'ring-2 ring-yellow-400 ring-opacity-60 shadow-lg' : ''
                                } ${
                                  !isPastShift && periodType === 'current' && isPeriodEnding ? 'ring-2 ring-orange-400 ring-opacity-50' :
                                  !isPastShift && periodType === 'next' ? 'ring-2 ring-green-400 ring-opacity-50' : ''
                                }`}
                                onClick={() => handleEditShift(shift)}
                                title={`${getCaregiverName(shift.caregiver_id)} - ${periodLabel} ${shift.shift_type} shift${isToday ? ' (Today)' : ''}${isPastShift ? ' (Completed)' : ''}`}
                              >
                                {/* Status indicators */}
                                <div className="absolute top-1 right-1 flex gap-1">
                                  {isPastShift && (
                                    <div className="w-2 h-2 bg-gray-400 rounded-full opacity-70" title="Completed shift"></div>
                                  )}
                                  {!isPastShift && periodType === 'current' && isPeriodEnding && (
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Period ending soon"></div>
                                  )}
                                  {!isPastShift && periodType === 'next' && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Next period"></div>
                                  )}
                                  {!isPastShift && periodType === 'current' && !isPeriodEnding && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" title="Current period"></div>
                                  )}
                                  {isToday && (
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Today"></div>
                                  )}
                                </div>
                                
                                {/* Caregiver info */}
                                <div className="pr-6">
                                  <div className="font-semibold truncate text-sm mb-1">
                                    {getCaregiverName(shift.caregiver_id)}
                                  </div>
                                  
                                  {/* Time and shift type */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs opacity-80">
                                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                    </div>
                                    <Badge 
                                      variant={isPastShift ? 'outline' : shift.shift_type === 'Day' ? 'default' : 'secondary'}
                                      className={`text-xs h-5 ${
                                        isPastShift 
                                          ? 'opacity-60 border-gray-300 text-gray-500 bg-white' 
                                          : shift.shift_type === 'Day'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-purple-600 text-white border-purple-600'
                                      }`}
                                    >
                                      {shift.shift_type}
                                    </Badge>
                                  </div>
                                  
                                  {/* Status badges */}
                                  <div className="flex gap-1 flex-wrap">
                                    {isPastShift && (
                                      <Badge variant="outline" className="text-xs h-5 opacity-60 border-gray-300 text-gray-500 bg-white">
                                        Completed
                                      </Badge>
                                    )}
                                    {!isPastShift && periodType === 'current' && isPeriodEnding && (
                                      <Badge variant="destructive" className="text-xs h-5 bg-orange-600 border-orange-600">
                                        Period End
                                      </Badge>
                                    )}
                                    {!isPastShift && periodType === 'next' && (
                                      <Badge variant="outline" className="text-xs h-5 border-green-300 text-green-700 bg-green-50">
                                        Next
                                      </Badge>
                                    )}
                                    {isToday && !isPastShift && (
                                      <Badge variant="outline" className="text-xs h-5 border-yellow-400 text-yellow-700 bg-yellow-50">
                                        Today
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Hover edit button */}
                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 bg-white/80 hover:bg-white border border-gray-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditShift(shift);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-Rotation Settings Dialog */}
      <Dialog open={isAutoRotationDialogOpen} onOpenChange={setIsAutoRotationDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Auto-Rotation Settings</DialogTitle>
            <DialogDescription>
              Configure automatic caregiver shift rotation when shifts are about to end.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRotationEnabled"
                checked={autoRotationSettings.enabled}
                onChange={(e) => setAutoRotationSettings(prev => ({ 
                  ...prev, 
                  enabled: e.target.checked 
                }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="autoRotationEnabled" className="text-sm font-medium">
                Enable automatic rotation
              </Label>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="leadTime" className="text-right text-sm">
                Lead Time (hours)
              </Label>
              <Input
                id="leadTime"
                type="number"
                min="1"
                max="12"
                value={autoRotationSettings.leadTimeHours}
                onChange={(e) => setAutoRotationSettings(prev => ({ 
                  ...prev, 
                  leadTimeHours: parseInt(e.target.value) || 4 
                }))}
                className="col-span-3"
                disabled={!autoRotationSettings.enabled}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rotationPattern" className="text-right text-sm">
                Rotation Pattern
              </Label>
              <Select 
                value={autoRotationSettings.rotationPattern} 
                onValueChange={(value: 'round-robin' | 'random') => 
                  setAutoRotationSettings(prev => ({ ...prev, rotationPattern: value }))
                }
                disabled={!autoRotationSettings.enabled}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round-robin">Round Robin (Alphabetical)</SelectItem>
                  <SelectItem value="random">Random Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-xs text-muted-foreground mt-2">
              <p>• Lead time determines how many hours before shift end to trigger rotation</p>
              <p>• Round robin selects next caregiver alphabetically</p>
              <p>• Random selection picks any available caregiver</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAutoRotationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setIsAutoRotationDialogOpen(false);
              toast({
                title: "Settings Updated",
                description: `Auto-rotation ${autoRotationSettings.enabled ? 'enabled' : 'disabled'}`,
              });
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View All Shifts Dialog */}
      <Dialog open={isViewAllDialogOpen} onOpenChange={setIsViewAllDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              All Shifts for {getCaregiverName(selectedCaregiverShifts.caregiverId)}
            </DialogTitle>
            <DialogDescription>
              {selectedCaregiverShifts.shifts.length} total shift{selectedCaregiverShifts.shifts.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCaregiverShifts.shifts.map((shift) => (
                  <TableRow key={shift.shift_id}>
                    <TableCell>{formatDate(shift.shift_date)}</TableCell>
                    <TableCell>
                      <Badge variant={shift.shift_type === 'Day' ? 'default' : 'secondary'}>
                        {shift.shift_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {shift.notes || 'No notes'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsViewAllDialogOpen(false);
                            handleEditShift(shift);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteShift(shift.shift_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewAllDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="caregiver" className="text-right">
                Caregiver
              </Label>
              <Select 
                value={editForm.caregiverId} 
                onValueChange={(value) => setEditForm(prev => ({ ...prev, caregiverId: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caregivers.map(caregiver => (
                    <SelectItem key={caregiver.caregiver_id} value={caregiver.caregiver_id}>
                      {caregiver.first_name} {caregiver.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shiftType" className="text-right">
                Shift Type
              </Label>
              <Select 
                value={editForm.shiftType} 
                onValueChange={(value: 'Day' | 'Night') => setEditForm(prev => ({ ...prev, shiftType: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day Shift</SelectItem>
                  <SelectItem value="Night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startTime" className="text-right">
                Start Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endTime" className="text-right">
                End Time
              </Label>
              <Input
                id="endTime"
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Input
                id="notes"
                placeholder="Optional notes..."
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveShift}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;